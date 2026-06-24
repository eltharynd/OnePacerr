import { randomUUID } from 'node:crypto'
import { formatConnectionError } from '../../util/format-connection-error.js'
import { LibraryConnectionError } from '../library.model.js'

const JELLYFIN_CONNECT_HELP =
	'Could not connect to Jellyfin — check JELLYFIN_URL and credentials'

export interface JellyfinConfig {
	baseUrl: string
	username?: string
	password?: string
	/** Shown in Jellyfin's "active devices" admin page. Defaults to "MyApp". */
	clientName?: string
	/** Defaults to "1.0.0". */
	clientVersion?: string
}

export interface JellyfinLibrary {
	Id: string
	Name: string
	CollectionType?: string
}
export interface JellyfinVirtualFolder {
	Id: string
	Name: string
	Locations: string[]
}

export interface JellyfinEpisode {
	Id: string
	Name: string
	IndexNumber?: number
	ParentIndexNumber?: number
	Path?: string
}

interface JellyfinViewsResponse {
	Items: JellyfinLibrary[]
}

export interface JellyfinItem {
	Id: string
	Name: string
	Type: string
	// ...add fields as you need them
}

interface JellyfinItemsResponse {
	Items: JellyfinItem[]
	TotalRecordCount: number
}

interface JellyfinAuthentication {
	AccessToken: string
	User: { Id: string }
}

interface JellyfinTask {
	Id: string
	Name: string
	Key: string // e.g. "RefreshLibrary"
	State: 'Idle' | 'Running' | 'Cancelling'
	CurrentProgressPercentage?: number
}

class JellyfinClient {
	private auth: JellyfinAuthentication
	private readonly deviceId: string

	constructor(private config: JellyfinConfig) {
		this.deviceId = randomUUID()
	}

	private connectionError(
		label: string,
		error: unknown,
	): LibraryConnectionError {
		return new LibraryConnectionError(
			`${JELLYFIN_CONNECT_HELP}. ${formatConnectionError(label, this.config.baseUrl, error)}`,
			{ cause: error },
		)
	}

	private async fetchJellyfin(
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

	private authorizationHeader(token?: string): string {
		const parts = [
			`Client="${this.config.clientName ?? 'MyApp'}"`,
			`Device="Node"`,
			`DeviceId="${this.deviceId}"`,
			`Version="${this.config.clientVersion ?? '1.0.0'}"`,
		]
		if (token) parts.push(`Token="${token}"`)
		return `MediaBrowser ${parts.join(', ')}`
	}

	private async request<T>(
		path: string,
		options: { method?: string; params?: Record<string, string> } = {},
	): Promise<T> {
		const url = new URL(`${this.config.baseUrl}${path}`)
		for (const [k, v] of Object.entries(options.params ?? {})) {
			url.searchParams.set(k, v)
		}

		const headers: Record<string, string> = {
			Authorization: this.authorizationHeader(this.auth.AccessToken),
		}

		const res = await this.fetchJellyfin(
			url.toString(),
			`Jellyfin API ${path}`,
			{
				method: options.method ?? 'GET',
				headers,
			},
		)

		if (!res.ok) {
			throw new LibraryConnectionError(
				`${JELLYFIN_CONNECT_HELP}. Jellyfin request failed (${path}): HTTP ${res.status} ${res.statusText} at ${this.config.baseUrl}`,
			)
		}

		const text = await res.text()
		return (text ? JSON.parse(text) : undefined) as T
	}

	async login() {
		const res = await this.fetchJellyfin(
			`${this.config.baseUrl}/Users/AuthenticateByName`,
			'Jellyfin login',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: this.authorizationHeader(),
				},
				body: JSON.stringify({
					Username: this.config.username,
					Pw: this.config.password,
				}),
			},
		)

		if (!res.ok) {
			throw new LibraryConnectionError(
				`${JELLYFIN_CONNECT_HELP}. Jellyfin login failed for user '${this.config.username}' at ${this.config.baseUrl}: HTTP ${res.status} ${res.statusText}`,
			)
		}

		this.auth = await res.json()
	}

	getSystemInfo() {
		return this.request('/System/Info')
	}

	getItems(params: Record<string, string> = {}) {
		return this.request<JellyfinItemsResponse>(
			`/Users/${this.auth.User.Id}/Items`,
			{ params },
		)
	}

	async getLibraries(): Promise<JellyfinLibrary[]> {
		const res = await this.request<JellyfinViewsResponse>(
			`/Users/${this.auth.User.Id}/Views`,
		)
		return res.Items
	}

	async getLibraryLocations(
		libraryName: string,
	): Promise<JellyfinVirtualFolder[]> {
		const folders = await this.request<JellyfinVirtualFolder[]>(
			'/Library/VirtualFolders',
		)
		return folders.filter(f => f.Name === libraryName)
	}

	async findShowInLibrary(
		libraryId: string,
		showName: string,
	): Promise<JellyfinItem[]> {
		const res = await this.request<JellyfinItemsResponse>(
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
	): Promise<JellyfinEpisode[]> {
		const res = await this.request<{ Items: JellyfinEpisode[] }>(
			`/Shows/${seriesId}/Episodes`,
			{
				params: { Fields: fields.join(',') },
			},
		)
		return res.Items
	}

	refreshSeries(seriesId: string): Promise<void> {
		return this.request<void>(`/Items/${seriesId}/Refresh`, {
			method: 'POST',
			params: {
				Recursive: 'true',
				MetadataRefreshMode: 'FullRefresh',
				ImageRefreshMode: 'FullRefresh',
				ReplaceAllMetadata: 'false',
				ReplaceAllImages: 'false',
			},
		})
	}

	getTasks(): Promise<JellyfinTask[]> {
		return this.request<JellyfinTask[]>('/ScheduledTasks')
	}

	getTask(taskId: string): Promise<JellyfinTask> {
		return this.request<JellyfinTask>(`/ScheduledTasks/${taskId}`)
	}

	startTask(taskId: string): Promise<void> {
		return this.request<void>(`/ScheduledTasks/Running/${taskId}`, {
			method: 'POST',
		})
	}
}

export default JellyfinClient
