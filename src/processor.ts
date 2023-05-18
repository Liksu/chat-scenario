import ScenarioParser from "./parser";

export default class Scenario {
    static defaultAct = ScenarioParser.defaultAct
    
    scenario = {}
    history = []
    act = null
    context = {}
    queue = []
    parsedData = null
    config = {}

    constructor(scenario, config = {}) {
        if (typeof scenario === 'string') {
            scenario = new ScenarioParser(scenario, config)
        }

        this.parsedData = scenario
        this.scenario = scenario.scenario
        Object.assign(this.config, config, scenario.config)
    }

    build(context = this.context, act = Scenario.defaultAct) {
        return this.scenario[act]
            ?.filter(message => !message[this.config.roleKey].startsWith(this.config.comment))
            .map(message => ({
                ...message,
                [this.config.contentKey]: message[this.config.contentKey]
                    .replace(/\{(\w+)}/g, (_, key) => context[key] ?? '???')
            })) ?? []
    }

    execute(context, act = Scenario.defaultAct) {
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
            index = this.scenario[Scenario.orderSymbol].indexOf(context)
            context = null
        }

        this.queue = this.scenario[Scenario.orderSymbol].slice(index)

        if (!context) return this

        this.act = this.queue.shift()
        return this.execute(context, this.act)
    }

    get placeholders() {
        return this.scenario[this.act]?.[Scenario.placeholderSymbol] ?? []
    }

    get actConfig() {
        return this.scenario[this.act]?.[Scenario.configSymbol]
            ?? this.scenario[Scenario.defaultAct]?.[Scenario.configSymbol]
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
        return this.scenario[this.queue[0]]?.[Scenario.placeholderSymbol] ?? []
    }

    get nextConfig() {
        return this.scenario[this.queue[0]]?.[Scenario.configSymbol] ?? {}
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
