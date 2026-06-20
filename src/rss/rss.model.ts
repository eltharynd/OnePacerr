export interface Item {
	'torrent:magnetURI'?: string
	'torrent:infoHash'?: string
	categories?: Array<{
		_: string
		$?: { domain: string }
	}>
	guid: string
	title: string
	link: string
}

export interface Feed {
	items: Item[]
}
