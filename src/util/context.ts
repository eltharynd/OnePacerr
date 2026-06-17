import { Express } from '../api/express.js'

class ContextContainer {
	express: Express
}

export const Context = new ContextContainer()

export default {
	express: Express,
}
