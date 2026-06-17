import { Express } from '../api/express.js'
import { KeycloakManager } from '../keycloak/keycloak.manager.js'

class ContextContainer {
	express: Express
	keycloak: KeycloakManager
}

export const Context = new ContextContainer()

export default {
	express: Express,
	keycloak: KeycloakManager,
}
