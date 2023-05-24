import Scenario from '../src/scenario'
import { colorsScenarioFullMap, colorsScenarioMessagesMap, colorsScenarioReference } from './colors.reference'
import { readFileSync } from 'fs'

const colorsScenarioText = readFileSync('test/colors.scenario', 'utf8')

describe('ScenarioParser helpers', () => {
    let scenario: Scenario<'sender'>

    beforeAll(() => {
        scenario = new Scenario<'sender'>(colorsScenarioText)
    })

    it('should returns act config', () => {
        const actConfig = scenario.getActConfig('Final')
        expect(actConfig).toEqual(colorsScenarioReference.acts.Final.config)
    })

    it('should returns act placeholders', () => {
        const actPlaceholders = scenario.getActPlaceholders('default')
        expect(actPlaceholders).toEqual(['name'])
    })

    it('should transform scenario to full map', () => {
        const map = scenario.getActsMap()
        expect(map).toEqual(colorsScenarioFullMap)
    })

    it('should transform scenario to messages map', () => {
        const map = scenario.getActsMap(null, true)
        expect(map).toEqual(colorsScenarioMessagesMap)
    })
})

