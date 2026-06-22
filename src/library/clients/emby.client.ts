import { randomUUID } from 'node:crypto'
import { formatConnectionError } from '../../util/format-connection-error.js'

const EMBY_CONNECT_HELP =
	'Could not connect to Emby — check EMBY_URL and credentials'

export class EmbyConnectionError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = 'EmbyConnectionError'
	}
}

export interface EmbyConfig {
	baseUrl: string
	username?: string
	password?: string
}

export interface EmbyLibrary {
	Id: string
	Name: string
	CollectionType?: string
}
export interface EmbyVirtualFolder {
	Id: string
	Name: string
	Locations: string[]
}

export interface EmbyEpisode {
	Id: string
	Name: string
	IndexNumber?: number
	ParentIndexNumber?: number
	Path?: string
}

interface EmbyViewsResponse {
	Items: EmbyLibrary[]
}

export interface EmbyItem {
	Id: string
	Name: string
	Type: string
	// ...add fields as you need them
}

interface EmbyItemsResponse {
	Items: EmbyItem[]
	TotalRecordCount: number
}

interface EmbyAuthentication {
	AccessToken: string
	User: { Id: string }
}

interface EmbyTask {
	Id: string
	Name: string
	Key: string // e.g. "RefreshLibrary"
	State: 'Idle' | 'Running' | 'Cancelling'
	CurrentProgressPercentage?: number
}

class EmbyClient {
	private auth: EmbyAuthentication

	constructor(private config: EmbyConfig) {}

	private connectionError(label: string, error: unknown): EmbyConnectionError {
		return new EmbyConnectionError(
			`${EMBY_CONNECT_HELP}. ${formatConnectionError(label, this.config.baseUrl, error)}`,
			{ cause: error },
		)
	}

	private async fetchEmby(
		url: string,
		label: string,
		options?: RequestInit,
	): Promise<Response> {
		try {
			return await fetch(url, options)
		} catch (error) {
			throw this.connectionError(label, error)
		}
	}

	private async request<T>(
		path: string,
		options: { method?: string; params?: Record<string, string> } = {},
	): Promise<T> {
		const url = new URL(`${this.config.baseUrl}/emby${path}`)
		for (const [k, v] of Object.entries(options.params ?? {})) {
			url.searchParams.set(k, v)
		}

		const headers: Record<string, string> = {}
		headers['X-Emby-Token'] = this.auth.AccessToken

		const res = await this.fetchEmby(url.toString(), `Emby API ${path}`, {
			method: options.method ?? 'GET',
			headers,
		})

		if (!res.ok) {
			throw new EmbyConnectionError(
				`${EMBY_CONNECT_HELP}. Emby request failed (${path}): HTTP ${res.status} ${res.statusText} at ${this.config.baseUrl}`,
			)
		}

		const text = await res.text()
		return (text ? JSON.parse(text) : undefined) as T
	}

	async login(deviceId?: string) {
		const res = await this.fetchEmby(
			`${this.config.baseUrl}/emby/Users/AuthenticateByName`,
			'Emby login',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Emby-Authorization': `Emby Client="MyApp", Device="Node", DeviceId="${deviceId || randomUUID()}", Version="1.0.0"`,
				},
				body: JSON.stringify({
					Username: this.config.username,
					Pw: this.config.password,
				}),
			},
		)

		if (!res.ok) {
			throw new EmbyConnectionError(
				`${EMBY_CONNECT_HELP}. Emby login failed for user '${this.config.username}' at ${this.config.baseUrl}: HTTP ${res.status} ${res.statusText}`,
			)
		}

		this.auth = await res.json()
	}

	getSystemInfo() {
		return this.request('/System/Info')
	}

	getItems(params: Record<string, string> = {}) {
		return this.request<EmbyItemsResponse>(
			`/Users/${this.auth.User.Id}/Items`,
			params,
		)
	}

	async getLibraries(): Promise<EmbyLibrary[]> {
		const res = await this.request<EmbyViewsResponse>(
			`/Users/${this.auth.User.Id}/Views`,
		)
		return res.Items
	}

	async getLibraryLocations(libraryName: string): Promise<EmbyVirtualFolder[]> {
		const folders = await this.request<EmbyVirtualFolder[]>(
			'/Library/VirtualFolders',
		)
		return folders.filter(f => f.Name === libraryName)
	}

	async findShowInLibrary(
		libraryId: string,
		showName: string,
	): Promise<EmbyItem[]> {
		const res = await this.request<EmbyItemsResponse>(
			`/Users/${this.auth.User.Id}/Items`,
			{
				params: {
					ParentId: libraryId,
					IncludeItemTypes: 'Series',
					Recursive: 'true',
					SearchTerm: showName,
				},
			},
		)
		return res.Items.filter(
			item => item.Name.toLowerCase() === showName.toLowerCase(),
		)
	}

	async getEpisodes(
		seriesId: string,
		fields: string[] = [],
	): Promise<EmbyEpisode[]> {
		const res = await this.request<{ Items: EmbyEpisode[] }>(
			`/Shows/${seriesId}/Episodes`,
			{
				params: { Fields: fields.join(',') },
			},
		)
		return res.Items
	}

	getTasks(): Promise<EmbyTask[]> {
		return this.request<EmbyTask[]>('/ScheduledTasks')
	}

	getTask(taskId: string): Promise<EmbyTask> {
		return this.request<EmbyTask>(`/ScheduledTasks/${taskId}`)
	}

	startTask(taskId: string): Promise<void> {
		return this.request<void>(`/ScheduledTasks/Running/${taskId}`, {
			method: 'POST',
		})
	}
}

export default EmbyClient
