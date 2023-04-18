import {readFileSync} from "fs";
import Scenario from "../index.js";

const colors = readFileSync('test/colors.scenario', 'utf8')

const expectedScenario = {
    default: Object.assign([
        {
            role: 'system',
            content: 'define constants:\n' +
                'COLORS=RED,GREEN,BLUE\n' +
                'RED+GREEN=strawberry\n' +
                'RED+BLUE=sea sunset\n' +
                'GREEN+BLUE=forest'
        },
        {
            role: 'system',
            content: 'Rules:\n' +
                'You greets the user by name and propose to choose a color from COLORS. Then, you take random color from COLORS and tell user the both colors and the result of their from GRB palette.'
        },
        {
            role: 'user',
            content: 'Hi, my name is {name}'
        }
    ], {[Scenario.placeholderSymbol]: ['name']}),
    Choice: Object.assign([
        {
            role: 'user',
            content: 'I choose {color}'
        }
    ], {[Scenario.placeholderSymbol]: ['color']}),
    Final: Object.assign([
        {
            role: 'system',
            content: 'Now taking both colors, find in constants the result of their combination and describe the picture based on it.'
        },
        {
            role: 'user',
            content: 'Let it be something from {area} area '
        }
    ], {[Scenario.placeholderSymbol]: ['area']}),
    [Scenario.orderSymbol]: ['default', 'Choice', 'Final']
}

const firstAnswer = {
    role: 'assistant',
    content: `Hello John! Nice to meet you. I'd like you to choose a color from the following options: RED, GREEN, or BLUE. Once you've chosen your color, I'll select another one at random, and we'll see what combination they create in the GRB palette.`
}

const secondAnswer = {
    role: 'assistant',
    content: `Great, John! You've chosen RED. I'll now randomly pick a color from the COLORS list. Let's see... I've chosen BLUE. So, the combination of RED and BLUE gives us "sea sunset" according to the GRB palette. Isn't that a beautiful mix?`
}

const thirdAnswer = {
    role: 'assistant',
    content: `Alright, based on your choice of RED and my random selection of BLUE, we found that their combination is "sea sunset" in the constants provided. Let me describe a scene inspired by space using this combination.\n\nImagine a breathtaking cosmic vista, where the glow of a distant nebula resembles a "sea sunset." The warm, deep red hues of the surrounding interstellar clouds blend harmoniously with the cooler blues of nearby cosmic dust, creating a visual symphony. In the vast expanse of space, the "sea sunset" colors evoke a sense of serenity and awe, as if the stars themselves have gathered to witness the majesty of the universe's artwork. The scene is a testament to the beauty and the infinite possibilities that can be found in the depths of outer space.`
}

const config = {
    join: ' ',
    comment: '#',
    test: true,
    order: ['assistant', 'user']
}


describe('Scenario', () => {
    const colorsScenario = new Scenario(colors)

    test('Initializes', () => {
        expect(colorsScenario).toBeInstanceOf(Scenario)
    })

    test('Prepares scenario', () => {
        expect(colorsScenario.scenario).toEqual(expectedScenario)
    })
    
    test('Config updated correctly', () => {
        expect(colorsScenario.config).toEqual(config)
    })

    test('Messages are correct array', () => {
        const startMessages = colorsScenario.start({name: 'John'})

        expect(startMessages).toBeInstanceOf(Array)
        expect(startMessages.length).toEqual(3)
        startMessages.forEach(message => {
            expect(message).toHaveProperty('role')
            expect(message).toHaveProperty('content')
        })
    })
    
    test('Last item is the user input', () => {
        expect(colorsScenario.history.at(-1).content).toEqual('Hi, my name is John')
    })

    test('Answer is stored', () => {
        colorsScenario.answer(firstAnswer)

        expect(colorsScenario.history.at(-1)).toEqual(firstAnswer)
    })
    
    test('Check selection', () => {
        const choiceMessages = colorsScenario.next({color: 'red'})

        expect(choiceMessages).toEqual([
            {
                role: 'user',
                content: 'I choose red'
            }
        ])
    })
    
    test('Check history', () => {
        expect(colorsScenario.history.at(-1)).toEqual({
            role: 'user',
            content: 'I choose red'
        })
    })
    
    test('Check final', () => {
        colorsScenario.answer(secondAnswer)
        const finalMessages = colorsScenario.next({area: 'space'})
        colorsScenario.answer(thirdAnswer)

        const expectedHistory = [
            ...colorsScenario.build(undefined, 'default'),
            firstAnswer,
            ...colorsScenario.build(undefined, 'Choice'),
            secondAnswer,
            ...colorsScenario.build(undefined, 'Final'),
            thirdAnswer
        ]
        
        expect(colorsScenario.history).toEqual(expectedHistory)
    })
})