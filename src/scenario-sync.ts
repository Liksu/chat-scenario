import { DeepPartial, ScenarioConfig, ScenarioData, ScenarioParserConfig } from './interfaces'
import Scenario from './scenario'

export default class ScenarioSync<RoleKey extends string = 'role', ContentKey extends string = 'content'> extends Scenario<RoleKey, ContentKey> {
    public state = {
        scenario: null,
        history: [],
        act: null,
        context: {},
        queue: [],
    }
}
