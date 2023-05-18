import { readFileSync } from 'fs'
import ScenarioParser from '../src/parser'
import { colorsScenarioFullMap, colorsScenarioMessagesMap, colorsScenarioReference } from './colors.reference'
import chatScenarioReference from './chat.reference'
import { ScenarioParserConfig } from '../src/interfaces'

const colorsScenarioText = readFileSync('test/colors.scenario', 'utf8')
const chatScenarioText = readFileSync('test/chat.scenario', 'utf8')

describe('ScenarioParser.constructor', () => {
    it('should parse the correct scenario and store it', () => {
        const parser = new ScenarioParser<'sender'>(colorsScenarioText)
        const scenario = parser.scenario

        expect(scenario).toEqual(colorsScenarioReference)
        expect(parser.config).toEqual({
            join: ' ',
            comment: '#',
            newLine: '\\',
            keys: { role: 'sender', content: 'content', defaultAct: 'default' },
            unused: { option: true }
        })
    })
})

describe('ScenarioParser.parse', () => {
    it('should parse without changing the main object', () => {
        const parser = new ScenarioParser(undefined, {
            keys: {defaultAct: 'main'}
        } as ScenarioParserConfig)
        const scenario = parser.parse(chatScenarioText)

        expect(scenario).toEqual(chatScenarioReference)
        expect(parser.config).toEqual({
            join: ' ',
            comment: '#',
            newLine: '\\',
            keys: { role: 'role', content: 'content', defaultAct: 'main' },
        })
    })
})

describe('ScenarioParser helpers', () => {
    let parser: ScenarioParser<'sender'>
    
    beforeAll(() => {
        parser = new ScenarioParser<'sender'>(colorsScenarioText)
    })
    
    it('should returns act config', () => {
        const actConfig = parser.getActConfig('Final')
        expect(actConfig).toEqual({
            loop: true,
            stopWord: 'exit'
        })
    })

    it('should returns act placeholders', () => {
        const actPlaceholders = parser.getActPlaceholders('default')
        expect(actPlaceholders).toEqual(['name'])
    })

    it('should transform scenario to full map', () => {
        const map = parser.getActsMap()
        expect(map).toEqual(colorsScenarioFullMap)
    })

    it('should transform scenario to messages map', () => {
        const map = parser.getActsMap(null, true)
        expect(map).toEqual(colorsScenarioMessagesMap)
    })
})