const config = {
    extends: 'stylelint-config-standard',
    plugins: ['stylelint-order', 'stylelint-selector-bem-pattern'],
    rules: {
        'order/order': ['custom-properties', 'declarations'],
        'order/properties-alphabetical-order': true,
        'function-no-unknown': true,

        'declaration-no-important': true,

        'selector-class-pattern': '^([a-z-]*[a-z]+)?(__[a-z-]*[a-z]+)?(--[a-z-]*[a-z]+)?$',
        'plugin/selector-bem-pattern': {
            componentName: '^[a-z]+(?:-[a-z]+)*$',
            componentSelectors: '^([.][a-z-]*[a-z]+)?(__[a-z-]*[a-z]+)?(--[a-z-]*[a-z]+)?$',
        },
    },
};

export default config;
