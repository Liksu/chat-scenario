import { ScenarioConfigRecognizedValue } from './interfaces'

export const COMA_REGEXP = /,(?=(?:[^"]|"[^"]*")*$)/
export const CONFIG_REGEXP = /^%\s*(.*)\s*\n?/gm
export const BLOCK_SPLITTER_REGEXP = /(?:\s*\n\s*){2,}/m
export const LINE_SPLITTER_REGEXP = /\s*\n\s*/m
export const ACT_BRACKETS_REGEXP = /^\s*\[\s*|\s*]\s*$/g
export const CHECK_ACT_REGEXP = /^\s*\[.*?]\s*$/m
export const DEFAULT_CONTENT_REGEXP = /^(.+?)\n\s*\n\s*\[.*?]\s*\n/s
export const CONFIG_LINE_REGEXP = /^\s*(?<key>[^=]*?)\s*=\s*(?<value>.*?)\s*$/

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