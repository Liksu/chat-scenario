import {
    DeepPartial,
    ScenarioConfig,
    ScenarioConfigRecognizedValue,
    ScenarioContext,
    ScenarioParserConfig
} from './interfaces'

export const COMA_REGEXP = /,(?=(?:[^"]|"[^"]*")*$)/
export const CONFIG_REGEXP = /^%\s*(.*)\s*\n?/gm
export const BLOCK_SPLITTER_REGEXP = /(?:\s*\n\s*){2,}/m
export const LINE_SPLITTER_REGEXP = /\s*\n\s*/m
export const ACT_BRACKETS_REGEXP = /^\s*\[\s*|\s*]\s*$/g
export const CHECK_ACT_REGEXP = /^\s*\[.*?]\s*$/m
export const DEFAULT_CONTENT_REGEXP = /^(.+?)\n\s*\n\s*\[.*?]\s*\n/s
export const CONFIG_LINE_REGEXP = /^\s*(?<key>[^=]*?)\s*=\s*(?<value>.*?)\s*$/
export const PLACEHOLDERS_REGEXP = /\{([^{}]+?)}/g
export const CONFIG_DIRECTIVE_REGEXP = /^[\w.-]+$/
export const PLUGIN_FUNCTION_REGEXP = /@(?<name>[a-z]\w*)\((?<params>[^)]+)\)/i

export const trySpecial = (value: string): string | null => {
    if (value === '\\n') return '\n'
    if (value === '\\t') return '\t'
    if (value === '\\s') return ' '
    return null
}

export const tryBoolean = (value: string): boolean | null => {
    return value === 'true' ? true : value === 'false' ? false : null
}

export const tryNumber = (value: string): number | null => {
    return !isNaN(parseFloat(value)) ? parseFloat(value) : null
}

export const tryArray = (value: string): ScenarioConfigRecognizedValue[] | null => {
    return COMA_REGEXP.test(value)
        ? value
            .split(COMA_REGEXP)
            .map(item => restoreType(item.trim(), false))
            .filter(item => item !== '')
        : null
}

export function restoreType(value: string, checkForArray: false): ScenarioConfigRecognizedValue
export function restoreType(value: string, checkForArray?: true): ScenarioConfigRecognizedValue | ScenarioConfigRecognizedValue[]
export function restoreType(value: string, checkForArray = true): ScenarioConfigRecognizedValue | ScenarioConfigRecognizedValue[] {
    return (checkForArray ? tryArray(value) : null)
        ?? trySpecial(value)
        ?? tryBoolean(value)
        ?? tryNumber(value)
        ?? value
}

export function mergeConfigs(base: ScenarioParserConfig, extend: DeepPartial<ScenarioParserConfig> | null): ScenarioParserConfig {
    return {
        ...base,
        ...extend,
        keys: {
            ...base.keys,
            ...(extend?.keys || {})
        }
    }
}

export function deepSet<T = ScenarioConfig>(target: T, path: string, value: unknown) {
    let targetRef: any = target
    let targetKey = path.trim()
    
    if (/\./.test(path)) {
        const parts = path.split('.').map(part => part.trim()).filter(Boolean)
        targetKey = parts.pop() as string
        targetRef = parts.reduce((ref, key) => {
            if (!ref[key]) ref[key] = {}
            return ref[key]
        }, targetRef)
    }
    
    targetRef[targetKey] = value
}

export function deepGet<T = ScenarioContext>(source: T, path: string): Exclude<T, T>[keyof T] {
    const parts = path.split('.').map(part => part.trim()).filter(Boolean)
    let ref: T = source
    
    while (parts.length && typeof ref === 'object' && ref) {
        ref = ref[parts.shift() as keyof T] as T
    }
    
    return ref as Exclude<T, T>[keyof T]
}

export const clone = typeof structuredClone === 'function'
    ? structuredClone
    : <T = unknown>(value: T): T => JSON.parse(JSON.stringify(value))

/**
 * Creates the prototype chain of objects in the order of the passed arguments
 * @param {object} objects
 * @returns {object | null}
 */
export function inherit<T = Record<string, unknown>>(...objects: T[]): T | null {
    return objects
        .filter(Boolean)
        .reduceRight((proto, current) => {
            return Object.create(proto, Object.getOwnPropertyDescriptors(clone(current)))
        }, null)
}

export function mergeContexts(a: ScenarioContext, b: ScenarioContext): ScenarioContext {
    const target = {} as ScenarioContext

    const keys = [...Object.keys(a), ...Object.keys(b)].filter((key, index, array) => array.indexOf(key) === index)
    keys.forEach((key: keyof ScenarioContext) => {
        const valueA = a[key]
        const valueB = b[key]
        
        if (valueA === undefined) {
            target[key] = valueB
        } else if (valueB === undefined) {
            target[key] = valueA
        } else if (Array.isArray(valueA) && Array.isArray(valueB)) {
            target[key] = [...valueA, ...valueB]
        } else if (typeof valueA === 'object' && typeof valueB === 'object') {
            target[key] = mergeContexts(valueA as ScenarioContext, valueB as ScenarioContext)
        } else {
            target[key] = valueB
        }
    })
    
    return target
}
