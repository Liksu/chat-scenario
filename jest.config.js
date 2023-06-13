export default {
    roots: ['<rootDir>/test'],
    global: {
        'ts-jest': {
            useESM: true,
        }
    },
    moduleNameMapper: {
        '(.+)\\.js': '$1'
    },
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.[tj]sx?$': 'ts-jest',
    },
};
