import ScenarioParser from "./parser";
import { ScenarioParserConfig } from './interfaces'

export default class ScenarioProcessor<RoleKey extends string = 'role', ContentKey extends string = 'content'> {
    scenario = {}
    history = []
    act = null
    context = {}
    queue = []
    parsedData = null
    config = {}

    constructor(scenario?: string, config?: ScenarioParserConfig) {
        if (typeof scenario === 'string') {
            scenario = new ScenarioParser(scenario, config)
        }

        this.parsedData = scenario
        this.scenario = scenario.scenario
        Object.assign(this.config, config, scenario.config)
    }

    execute(context, act = ScenarioProcessor.defaultAct) {
        Object.assign(this.context, context)
        const messages = this.build(this.context, act)
            .map(message => {
                const action = this.config.actions?.[message.role]
                if (typeof action === 'function') return action(message.content, act, this.scenario, this)
                return action ?? message
            })
            .filter(Boolean)
        this.history.push(...messages)
        return messages
    }

    start(context) {
        this.clear()

        let index = 0
        if (Number.isInteger(context)) {
            index = context
            context = null
        } else if (typeof context === 'string') {
            index = this.scenario[ScenarioProcessor.orderSymbol].indexOf(context)
            context = null
        }

        this.queue = this.scenario[ScenarioProcessor.orderSymbol].slice(index)

        if (!context) return this

        this.act = this.queue.shift()
        return this.execute(context, this.act)
    }

    get placeholders() {
        return this.scenario[this.act]?.[ScenarioProcessor.placeholderSymbol] ?? []
    }

    get actConfig() {
        return this.scenario[this.act]?.[ScenarioProcessor.configSymbol]
            ?? this.scenario[ScenarioProcessor.defaultAct]?.[ScenarioProcessor.configSymbol]
            ?? this.config
    }

    next(context, returnHistory = false) {
        this.act = this.queue.shift() ?? null
        if (!this.act) return null

        const messages = this.execute(context, this.act)
        return returnHistory ? this.history : messages
    }

    get hasNext() {
        return this.queue[0] ?? null
    }

    get nextPlaceholders() {
        return this.scenario[this.queue[0]]?.[ScenarioProcessor.placeholderSymbol] ?? []
    }

    get nextConfig() {
        return this.scenario[this.queue[0]]?.[ScenarioProcessor.configSymbol] ?? {}
    }

    answer(message) {
        this.history.push(message)
    }

    end() {
        this.act = null
        this.queue = []
        return this.history
    }

    clear() {
        this.history = []
        this.act = null
        this.queue = []
        this.context = {}
    }

    readHistory(skipRoles = []) {
        if (!Array.isArray(skipRoles)) skipRoles = [skipRoles]
        const roleKey = this.config.roleKey || 'role'
        const contentKey = this.config.contentKey || 'content'

        return this.history
            .filter(message => !skipRoles.includes(message[roleKey]))
            .map(message => `${message[roleKey]}:\n\t${message[contentKey].replace(/\n/g, '\n\t')}`)
            .join('\n\n')
    }
}
