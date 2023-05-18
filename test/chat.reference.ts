import { ScenarioData } from '../src/interfaces'

export default {
    acts: {
        main: {
            messages: [
                {
                    role: 'user',
                    content: '{userInput}',
                }
            ],
            hasPlaceholders: true,
            placeholders: {
                userInput: null
            },
            config: {
                order: ['user', 'assistant'],
                stopWords: ['quit', 'exit', 'stop', 'bye', 'goodbye'],
                loop: true,
                sample: true
            }
        },
    },
    config: {
        order: ['main'],
        parserOverrides: {
            comment: '//'
        },
    }
} as ScenarioData
