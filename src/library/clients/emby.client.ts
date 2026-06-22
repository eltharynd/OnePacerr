import { randomUUID } from 'node:crypto'

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

		const res = await fetch(url.toString(), {
			method: options.method ?? 'GET',
			headers,
		})

		if (!res.ok) {
			throw new Error(`Emby request failed: ${res.status} ${res.statusText}`)
		}

		const text = await res.text()
		return (text ? JSON.parse(text) : undefined) as T
	}

	async login(deviceId?: string) {
		const res = await fetch(
			`${this.config.baseUrl}/emby/Users/AuthenticateByName`,
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
		if (!res.ok) throw new Error(`Login failed: ${res.status}`)

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
