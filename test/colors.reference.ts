import { ScenarioData } from '../src/interfaces'

export const colorsScenarioReference = {
    acts: {
        default: {
            messages: [
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
                    content: 'Hi, my name is {name}'
                }
            ],
            hasPlaceholders: true,
            placeholders: {
                name: "I don't want to tell you my name"
            },
            config: {
                parsed_values: ['string with spaces', true, 42, ' ', '\n', '\t', false, 'NaN'],
                unused: false
            }
        },
        Choice: {
            description: "this description will be excluded from messages\nit's a kind of a comment",
            messages: [
                {
                    sender: 'output',
                    content: 'If assistant suggests to choose just a COLOR,\nplease choose it from red, green or blue.'
                },
                {
                    sender: 'user',
                    content: 'I choose random color to not use of the placeholder'
                }
            ],
            hasPlaceholders: false,
            placeholders: {},
            config: {}
        },
        Final: {
            messages: [
                {
                    sender: 'output',
                    content: 'This output will be excluded in the runtime'
                },
                {
                    sender: 'system',
                    content: 'Now taking both colors, find in constants the result of their combination and describe the picture based on it.'
                },
                {
                    sender: 'user',
                    content: 'Let it be something from {area} area'
                }
            ],
            hasPlaceholders: true,
            placeholders: {
                area: null
            },
            config: {
                loop: true,
                stopWord: 'exit'
            }
        }
    },
    config: {
        order: ['default', 'Choice', 'Final'],
        parserOverrides: {
            keys: {
                role: 'sender',
            },
            unused: {
                option: true
            }
        },
        title: 'Colors imagination',
        version: 1,
        inputs: {
            colors: ['storable', 'required'],
            areas: ['blank']
        }
    }
} as ScenarioData<'sender'>

export const colorsScenarioFullMap = new Map([
    ['default', colorsScenarioReference.acts.default],
    ['Choice', colorsScenarioReference.acts.Choice],
    ['Final', colorsScenarioReference.acts.Final]
])

export const colorsScenarioMessagesMap = new Map([
    ['default', colorsScenarioReference.acts.default.messages],
    ['Choice', colorsScenarioReference.acts.Choice.messages],
    ['Final', colorsScenarioReference.acts.Final.messages]
])
