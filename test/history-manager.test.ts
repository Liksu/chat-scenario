import { colorsScenarioReference } from './colors.reference'
import { readFileSync } from 'fs'
import { ActName, HistoryManager, ScenarioState } from '../src'

const colorsScenarioText = readFileSync('test/colors.scenario', 'utf8')
const chatScenarioText = readFileSync('test/chat.scenario', 'utf8')

let colors: HistoryManager

describe('HistoryManager.next', () => {
    let state: ScenarioState
    let refQueue: ActName[]
    
    beforeAll(() => {
        colors = new HistoryManager().init(colorsScenarioText)
        state = colors.state!
        refQueue = colorsScenarioReference.config.order
    })

    it('should contain full queue before start', () => {
        expect(state.act).toBeNull()
        expect(state.queue).toEqual(refQueue)
    })
    
    it('should move the queue', () => {
        const messages = colors.next({})
        expect(messages).toEqual([
            {
                sender: 'system',
                content: 'define constants:\nCOLORS=RED,GREEN,BLUE\nRED+GREEN=strawberry\nRED+BLUE=sea sunset\nGREEN+BLUE=forest',
            },
            {
                sender: 'system',
                content: 'Rules:\nYou greets the user by name and propose to choose a color from COLORS. Then, you take random color from COLORS and tell user the both colors and the result of their from GRB palette.'
            },
            {
                sender: 'user',
                content: 'Hi, my name is I don\'t want to tell you my name'
            }
        ])
        
        expect(state.act).toEqual(refQueue[0])
        expect(state.queue).toEqual(refQueue.slice(1))
    })
    
    it('should move the queue again', () => {
        colors.next({})
        expect(state.act).toEqual(refQueue[1])
        expect(state.queue).toEqual(refQueue.slice(2))
    })
    
    it('should move the queue to end', () => {
        colors.next({})
        expect(state.act).toEqual(refQueue[2])
        expect(state.queue).toEqual([])
    })
    
    it('should not move anymore', () => {
        const messages = colors.next({})
        expect(messages).toBeNull()
        expect(state.act).toBeNull()
        expect(state.queue).toEqual([])
    })
})