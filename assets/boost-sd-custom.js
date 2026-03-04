/*********************** Custom JS for Boost AI Search & Discovery  ************************/
const customize = {

  customizeProductItem: (componentRegistry) => {

    componentRegistry.useComponentPlugin('ProductItem', {

      name: 'Modify Wishlist',

      enabled: true,

      apply: () => ({

        afterRender(element){

          let data = element?.getParams()?.props?.product;

          let availableVariants = data.variants.filter(function(e) {

            return e.available;

          })

          let firstAvailableVariants = typeof availableVariants[0] !== 'undefined' ? availableVariants[0] : data.variants[0];

          

          const wishlistHtml = document.createElement('div');

          wishlistHtml.classList.add('wishlist-engine');

          wishlistHtml.setAttribute('data-product_id', data.id);

          wishlistHtml.setAttribute('data-variant_id', firstAvailableVariants.id);

          wishlistHtml.setAttribute('data-full_button', 'false');

          

          let productItem = document.querySelector('[data-product-id="'+ data.id +'"]');

          productItem.querySelector('.boost-sd__product-image-wrapper').appendChild(wishlistHtml);

        }

      }),

    });

  }

}

window.__BoostCustomization__ = (window.__BoostCustomization__ ?? []).concat([customize.customizeProductItem]);