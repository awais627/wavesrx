(function () {
  'use strict';

  function formatMoney(cents) {
    if (window.theme && theme.Currency && typeof theme.Currency.formatMoney === 'function') {
      return theme.Currency.formatMoney(cents, theme.moneyFormat);
    }
    return '$' + (cents / 100).toFixed(2);
  }

  function getCartAddUrl() {
    if (window.theme && theme.routes && theme.routes.cartAdd) return theme.routes.cartAdd;
    return '/cart/add.js';
  }

  function getSelectedVariant(itemEl) {
    var select = itemEl.querySelector('[data-bundle-variant-select]');
    if (select) {
      var opt = select.options[select.selectedIndex];
      return {
        id: parseInt(opt.value, 10),
        price: parseInt(opt.getAttribute('data-price'), 10) || 0,
        available: !opt.disabled
      };
    }
    var hidden = itemEl.querySelector('[data-bundle-variant-input]');
    if (hidden) {
      return {
        id: parseInt(hidden.value, 10),
        price: parseInt(hidden.getAttribute('data-price'), 10) || 0,
        available: true
      };
    }
    return null;
  }

  function syncItemPrice(itemEl) {
    var v = getSelectedVariant(itemEl);
    var priceEl = itemEl.querySelector('[data-bundle-item-price]');
    if (v && priceEl) priceEl.innerHTML = formatMoney(v.price);
  }

  function syncItemSelectedState(itemEl) {
    var checkbox = itemEl.querySelector('[data-bundle-checkbox]');
    if (!checkbox) return;
    itemEl.classList.toggle('is-selected', checkbox.checked && !checkbox.disabled);
  }

  function pulseTotal(totalEl) {
    if (!totalEl) return;
    totalEl.classList.remove('is-pulse');
    void totalEl.offsetWidth;
    totalEl.classList.add('is-pulse');
    setTimeout(function () { totalEl.classList.remove('is-pulse'); }, 220);
  }

  function updateTotal(kitEl) {
    var items = kitEl.querySelectorAll('[data-bundle-item]');
    var total = 0;
    var checkedCount = 0;
    items.forEach(function (item) {
      var checkbox = item.querySelector('[data-bundle-checkbox]');
      if (!checkbox || !checkbox.checked || checkbox.disabled) return;
      var v = getSelectedVariant(item);
      if (v) {
        total += v.price;
        checkedCount += 1;
      }
    });
    var totalEl = kitEl.querySelector('[data-bundle-total]');
    if (totalEl) {
      totalEl.innerHTML = formatMoney(total);
      pulseTotal(totalEl);
    }
    var countSub = kitEl.querySelector('[data-bundle-count-sub]');
    if (countSub) {
      countSub.textContent = checkedCount + (checkedCount === 1 ? ' item selected' : ' items selected');
    }
    var addBtn = kitEl.querySelector('[data-bundle-add]');
    if (addBtn) addBtn.disabled = checkedCount === 0;
  }

  function collectItems(kitEl) {
    var items = kitEl.querySelectorAll('[data-bundle-item]');
    var payload = [];
    items.forEach(function (item) {
      var checkbox = item.querySelector('[data-bundle-checkbox]');
      if (!checkbox || !checkbox.checked || checkbox.disabled) return;
      var v = getSelectedVariant(item);
      if (v && v.id) payload.push({ id: v.id, quantity: 1 });
    });
    return payload;
  }

  function showError(kitEl, message) {
    var err = kitEl.querySelector('[data-bundle-error]');
    if (!err) return;
    err.textContent = message;
    err.hidden = false;
  }

  function clearError(kitEl) {
    var err = kitEl.querySelector('[data-bundle-error]');
    if (!err) return;
    err.textContent = '';
    err.hidden = true;
  }

  function dispatchAjaxAdded() {
    // The cart drawer listens for `ajaxProduct:added` but inspects the event
    // target for a `[name="id"]` child. Use a temporary form element so the
    // existing listener doesn't error out.
    var form = document.createElement('form');
    var input = document.createElement('input');
    input.setAttribute('name', 'id');
    input.value = '0';
    form.appendChild(input);
    document.body.appendChild(form);
    var evt;
    try {
      evt = new CustomEvent('ajaxProduct:added', { bubbles: true });
    } catch (e) {
      evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('ajaxProduct:added', true, true, null);
    }
    form.dispatchEvent(evt);
    setTimeout(function () { form.remove(); }, 0);
  }

  function setLoading(addBtn, loading) {
    if (!addBtn) return;
    var textEl = addBtn.querySelector('[data-bundle-add-text]');
    if (loading) {
      addBtn.classList.add('is-loading');
      addBtn.disabled = true;
      if (textEl) {
        addBtn.dataset.originalText = textEl.textContent;
        textEl.textContent = 'Adding';
      }
    } else {
      addBtn.classList.remove('is-loading');
      addBtn.disabled = false;
      if (textEl && addBtn.dataset.originalText) {
        textEl.textContent = addBtn.dataset.originalText;
      }
    }
  }

  function submitKit(kitEl) {
    clearError(kitEl);
    var items = collectItems(kitEl);
    if (items.length === 0) {
      showError(kitEl, 'Please select at least one item.');
      return;
    }
    var addBtn = kitEl.querySelector('[data-bundle-add]');
    setLoading(addBtn, true);

    fetch(getCartAddUrl(), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ items: items })
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, status: res.status, body: body };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          var msg = (result.body && (result.body.description || result.body.message)) ||
                    "Sorry, we couldn't add this kit to your cart.";
          showError(kitEl, msg);
          return;
        }
        dispatchAjaxAdded();
      })
      .catch(function () {
        showError(kitEl, 'Network error. Please try again.');
      })
      .then(function () {
        setLoading(addBtn, false);
        updateTotal(kitEl);
      });
  }

  function initKit(kitEl) {
    if (kitEl.dataset.bundleInit === '1') return;
    kitEl.dataset.bundleInit = '1';

    kitEl.addEventListener('change', function (e) {
      var t = e.target;
      var item = t.closest('[data-bundle-item]');
      if (t.matches('[data-bundle-checkbox]')) {
        if (item) syncItemSelectedState(item);
        updateTotal(kitEl);
      } else if (t.matches('[data-bundle-variant-select]')) {
        if (item) syncItemPrice(item);
        updateTotal(kitEl);
      }
    });

    kitEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-bundle-add]');
      if (!btn) return;
      e.preventDefault();
      submitKit(kitEl);
    });

    kitEl.querySelectorAll('[data-bundle-item]').forEach(function (item) {
      syncItemSelectedState(item);
      syncItemPrice(item);
    });
    updateTotal(kitEl);
  }

  function init() {
    document.querySelectorAll('[data-bundle-kit]').forEach(initKit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
