import { ScenarioData } from '../src'

export default {
    acts: {
        main: {
            messages: [
                {
                    role: 'user',
                    content: '{user-input:name}\nPlease, return the answer in the JSON format: { "answer": "the answer", "confidence": "the confidence" }',
                }
            ],
            hasPlaceholders: true,
            placeholders: {
                'user-input:name': 'default text'
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
