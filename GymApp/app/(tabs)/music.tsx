/**
 * music.tsx — Tab Musica (stile Demus)
 *
 * 3 sezioni:
 *  🔍 Cerca   — ricerca YouTube in tempo reale via Invidious API
 *  📚 Libreria — Mi piace + playlist personali create dall'utente
 *  🎵 Scopri   — playlist curate precaricate (Hardcore, Cardio, Metal, Chill)
 */
import { MiniPlayer } from '@/components/MiniPlayer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { CuratedPlaylist, Track, useMusic } from '@/context/MusicContext';
import { usePlaylists, UserPlaylist } from '@/context/PlaylistContext';
import { searchMusicBrainz } from '@/services/MusicBrainzService';
import {
	clearSearchCache,
	loadApiKey,
	saveApiKey,
	searchYouTube
} from '@/services/YouTubeSearchService';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Image,
	Keyboard,
	KeyboardAvoidingView,
	Modal,
	Platform,
	ScrollView,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

type ActiveTab = 'search' | 'library' | 'discover';

// ═══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ═══════════════════════════════════════════════════════════
export default function MusicScreen() {
	const {
		playTrack,
		addToQueue,
		curatedPlaylists,
		playPlaylist,
		currentTrack,
		isPlaying,
	} = useMusic();

	const {
		userPlaylists,
		likedSongs,
		createPlaylist,
		deletePlaylist,
		addTrackToPlaylist,
		removeTrackFromPlaylist,
		toggleLike,
		isLiked,
	} = usePlaylists();

	const { primaryColor } = useCustomTheme();

	// ─── Stato navigazione tab ────────────────────────────
	const [activeTab, setActiveTab] = useState<ActiveTab>('search');

	// ─── Stato ricerca ────────────────────────────────────
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState<Track[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// ─── Stato dettaglio playlist ─────────────────────────
	const [selectedPlaylist, setSelectedPlaylist] = useState<
		UserPlaylist | CuratedPlaylist | { id: 'liked'; name: string; tracks: Track[] } | null
	>(null);

	// ─── Modale "Aggiungi a Playlist" ─────────────────────
	const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<Track | null>(null);
	const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

	// ─── Modale "Nuova Playlist" ──────────────────────────
	const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
	const [newPlaylistName, setNewPlaylistName] = useState('');
	const [newPlaylistEmoji, setNewPlaylistEmoji] = useState('🎵');

	// ─── Modale Impostazioni API ──────────────────────────
	const [showSettings, setShowSettings] = useState(false);
	const [apiKeyInput, setApiKeyInput] = useState('');
	const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
	const [searchProvider, setSearchProvider] = useState<'youtube' | 'musicbrainz'>('youtube');

	// Carica chiave API e provider al mount
	useEffect(() => {
		loadApiKey().then((key) => {
			if (key) {
				setApiKeyInput(key);
				setApiKeyConfigured(true);
			}
		});
		AsyncStorage.getItem('@gym_app_search_provider').then((val) => {
			if (val === 'youtube' || val === 'musicbrainz') {
				setSearchProvider(val);
			}
		});
	}, []);

	const handleSaveApiKey = useCallback(async () => {
		const key = apiKeyInput.trim();
		await saveApiKey(key || null);
		clearSearchCache();
		setApiKeyConfigured(!!key);
		setShowSettings(false);
		Alert.alert(
			key ? '✓ Chiave salvata' : 'Chiave rimossa',
			key
				? 'La chiave YouTube API è stata salvata. La ricerca ora usa YouTube Data API v3.'
				: 'Chiave rimossa. La ricerca usa il metodo automatico (Innertube).'
		);
	}, [apiKeyInput]);

	const handleSelectProvider = useCallback(async (provider: 'youtube' | 'musicbrainz') => {
		setSearchProvider(provider);
		await AsyncStorage.setItem('@gym_app_search_provider', provider);
		clearSearchCache();
		// Esegui di nuovo la ricerca se la query non è vuota
		if (searchQuery.trim()) {
			setIsSearching(true);
			setSearchError(null);
			try {
				const results = provider === 'musicbrainz'
					? await searchMusicBrainz(searchQuery.trim())
					: await searchYouTube(searchQuery.trim());
				setSearchResults(results);
			} catch (e: any) {
				setSearchError(e.message ?? 'Errore di ricerca');
				setSearchResults([]);
			} finally {
				setIsSearching(false);
			}
		}
	}, [searchQuery]);

	// ─── Debounced search ────────────────────────────────
	const handleSearchInput = useCallback(
		(text: string) => {
			setSearchQuery(text);
			setSearchError(null);

			if (searchTimer.current) clearTimeout(searchTimer.current);

			if (!text.trim()) {
				setSearchResults([]);
				return;
			}

			// Debounce 500ms prima di cercare
			searchTimer.current = setTimeout(async () => {
				setIsSearching(true);
				setSearchError(null);
				try {
					const results = searchProvider === 'musicbrainz'
						? await searchMusicBrainz(text.trim())
						: await searchYouTube(text.trim());
					setSearchResults(results);
				} catch (e: any) {
					setSearchError(e.message ?? 'Errore di ricerca');
					setSearchResults([]);
				} finally {
					setIsSearching(false);
				}
			}, 500);
		},
		[searchProvider]
	);

	useEffect(() => {
		return () => {
			if (searchTimer.current) clearTimeout(searchTimer.current);
		};
	}, []);

	// ─── Apri modale aggiungi a playlist ─────────────────
	const openAddToPlaylist = useCallback((track: Track) => {
		setAddToPlaylistTrack(track);
		setShowAddToPlaylist(true);
	}, []);

	// ─── Aggiungi a playlist ──────────────────────────────
	const handleAddToPlaylist = useCallback(
		async (playlist: UserPlaylist) => {
			if (!addToPlaylistTrack) return;
			const added = await addTrackToPlaylist(playlist.id, addToPlaylistTrack);
			setShowAddToPlaylist(false);
			if (!added) {
				Alert.alert('Già presente', `"${addToPlaylistTrack.title}" è già in questa playlist.`);
			}
		},
		[addToPlaylistTrack, addTrackToPlaylist]
	);

	// ─── Crea nuova playlist ──────────────────────────────
	const handleCreatePlaylist = useCallback(async () => {
		if (!newPlaylistName.trim()) {
			Alert.alert('Errore', 'Inserisci un nome per la playlist.');
			return;
		}
		await createPlaylist(newPlaylistName.trim(), newPlaylistEmoji);
		setNewPlaylistName('');
		setNewPlaylistEmoji('🎵');
		setShowCreatePlaylist(false);
	}, [newPlaylistName, newPlaylistEmoji, createPlaylist]);

	// ─── Elimina playlist ─────────────────────────────────
	const handleDeletePlaylist = useCallback(
		(pl: UserPlaylist) => {
			Alert.alert(
				'Elimina Playlist',
				`Sei sicuro di voler eliminare "${pl.name}"?\nI brani non verranno eliminati.`,
				[
					{ text: 'Annulla', style: 'cancel' },
					{
						text: 'Elimina',
						style: 'destructive',
						onPress: () => deletePlaylist(pl.id),
					},
				]
			);
		},
		[deletePlaylist]
	);

	// ─── Helper formatDuration ────────────────────────────
	const formatDuration = (secs: number) => {
		if (!secs || secs <= 0) return '';
		const h = Math.floor(secs / 3600);
		const m = Math.floor((secs % 3600) / 60);
		const s = Math.floor(secs % 60).toString().padStart(2, '0');
		return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s}` : `${m}:${s}`;
	};

	// ═══════════════════════════════════════════════════════
	// SUB-COMPONENTE: Riga brano (riusata in tutte le tab)
	// ═══════════════════════════════════════════════════════
	const TrackRow = useCallback(
		({
			track,
			showLike = false,
			showAddToPlaylist: showAdd = false,
			showRemove = false,
			onRemove,
			compact = false,
		}: {
			track: Track;
			showLike?: boolean;
			showAddToPlaylist?: boolean;
			showRemove?: boolean;
			onRemove?: () => void;
			compact?: boolean;
		}) => {
			const isActive = currentTrack?.id === track.id;
			const liked = isLiked(track.id);

			return (
				<TouchableOpacity
					style={[
						styles.trackRow,
						isActive && { borderColor: `${primaryColor}66`, borderWidth: 1 },
						compact && styles.trackRowCompact,
					]}
					onPress={() => playTrack(track)}
					activeOpacity={0.7}
				>
					{/* Thumb */}
					<View style={styles.thumbWrap}>
						<Image source={{ uri: track.thumbnail }} style={styles.thumb} />
						{isActive && isPlaying && (
							<View style={[styles.thumbOverlay, { backgroundColor: `${primaryColor}bb` }]}>
								<Ionicons name="musical-notes" size={14} color="#fff" />
							</View>
						)}
					</View>

					{/* Info */}
					<View style={styles.trackInfo}>
						<ThemedText
							numberOfLines={1}
							style={[styles.trackTitle, isActive && { color: primaryColor }]}
						>
							{track.title}
						</ThemedText>
						<ThemedText numberOfLines={1} style={styles.trackArtist}>
							{track.artist}
							{track.duration > 0 ? ` • ${formatDuration(track.duration)}` : ''}
						</ThemedText>
					</View>

					{/* Azioni */}
					<View style={styles.trackActions}>
						{showLike && (
							<TouchableOpacity
								onPress={() => toggleLike(track)}
								hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
							>
								<Ionicons
									name={liked ? 'heart' : 'heart-outline'}
									size={20}
									color={liked ? '#e74c3c' : '#555'}
								/>
							</TouchableOpacity>
						)}
						{showAdd && (
							<TouchableOpacity
								onPress={() => openAddToPlaylist(track)}
								hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
							>
								<Ionicons name="add-circle-outline" size={22} color={primaryColor} />
							</TouchableOpacity>
						)}
						{showRemove && onRemove && (
							<TouchableOpacity
								onPress={onRemove}
								hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
							>
								<Ionicons name="close-circle" size={20} color="#ff4444" />
							</TouchableOpacity>
						)}
						{/* Menu 3 punti per aggiungere alla coda */}
						<TouchableOpacity
							onPress={() => addToQueue(track)}
							hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
						>
							<Ionicons name="ellipsis-vertical" size={18} color="#444" />
						</TouchableOpacity>
					</View>
				</TouchableOpacity>
			);
		},
		[currentTrack, isPlaying, primaryColor, isLiked, toggleLike, playTrack, openAddToPlaylist, addToQueue]
	);

	// ═══════════════════════════════════════════════════════
	// VISTA DETTAGLIO PLAYLIST (condivisa tra Libreria e Scopri)
	// ═══════════════════════════════════════════════════════
	if (selectedPlaylist) {
		const isUserPlaylist = 'emoji' in selectedPlaylist;
		const isLikedPlaylist = selectedPlaylist.id === 'liked';
		const tracks = selectedPlaylist.tracks as Track[];

		return (
			<ThemedView style={styles.container}>
				{/* Header */}
				<View style={styles.detailHeader}>
					<TouchableOpacity onPress={() => setSelectedPlaylist(null)} style={styles.backBtn}>
						<Ionicons name="arrow-back" size={24} color="#fff" />
					</TouchableOpacity>
					<ThemedText type="defaultSemiBold" style={styles.detailHeaderTitle} numberOfLines={1}>
						{isUserPlaylist ? selectedPlaylist.emoji + ' ' : ''}
						{selectedPlaylist.name}
					</ThemedText>
					<View style={{ width: 40 }} />
				</View>

				{/* Cover + azioni */}
				<View style={styles.detailHeroSection}>
					{/* Copertina: griglia delle prime 4 thumbnail o immagine se curated */}
					<View style={styles.detailCoverGrid}>
						{tracks.length === 0 ? (
							<View style={[styles.detailCoverPlaceholder, { backgroundColor: '#1a1a1a' }]}>
								<Ionicons name="musical-notes" size={40} color="#333" />
							</View>
						) : tracks.length === 1 ? (
							<Image source={{ uri: tracks[0].thumbnail }} style={styles.detailCoverSingle} />
						) : (
							<View style={styles.detailCoverGridInner}>
								{tracks.slice(0, 4).map((t, i) => (
									<Image key={i} source={{ uri: t.thumbnail }} style={styles.detailCoverQuarter} />
								))}
							</View>
						)}
					</View>

					<View style={styles.detailHeroMeta}>
						<ThemedText style={styles.detailName} numberOfLines={2}>
							{isUserPlaylist ? selectedPlaylist.emoji + ' ' : ''}
							{selectedPlaylist.name}
						</ThemedText>
						<ThemedText style={styles.detailCount}>{tracks.length} brani</ThemedText>
						{tracks.length > 0 && (
							<TouchableOpacity
								style={[styles.playAllBtn, { backgroundColor: primaryColor }]}
								onPress={() => {
									if (tracks.length > 0) {
										playTrack(tracks[0]);
										tracks.slice(1).forEach((t) => addToQueue(t));
									}
								}}
							>
								<Ionicons name="play" size={16} color="#000" />
								<ThemedText style={styles.playAllBtnText}>Riproduci</ThemedText>
							</TouchableOpacity>
						)}
					</View>
				</View>

				{/* Lista brani */}
				{tracks.length === 0 ? (
					<View style={styles.emptyPlaylist}>
						<Ionicons name="musical-notes-outline" size={48} color="#333" />
						<ThemedText style={styles.emptyText}>
							Questa playlist è vuota.{'\n'}
							Cerca un brano e aggiungilo!
						</ThemedText>
					</View>
				) : (
					<FlatList
						data={tracks}
						keyExtractor={(item, idx) => `${item.id}_${idx}`}
						contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 100 }}
						renderItem={({ item }) => (
							<TrackRow
								track={item}
								showLike={!isUserPlaylist && !isLikedPlaylist}
								showAddToPlaylist={!isUserPlaylist && !isLikedPlaylist}
								showRemove={isUserPlaylist || isLikedPlaylist}
								onRemove={() => {
									if (isLikedPlaylist) {
										toggleLike(item);
									} else if (isUserPlaylist) {
										removeTrackFromPlaylist(selectedPlaylist.id, item.id);
									}
								}}
							/>
						)}
					/>
				)}
				<MiniPlayer />
			</ThemedView>
		);
	}

	// ═══════════════════════════════════════════════════════
	// RENDER PRINCIPALE — tab navigation
	// ═══════════════════════════════════════════════════════
	return (
		<ThemedView style={styles.container}>

			{/* ── Tab Bar ── */}
			<View style={styles.tabBar}>
				{(
					[
						{ key: 'search', label: 'Cerca', icon: 'search' },
						{ key: 'library', label: 'Libreria', icon: 'albums' },
						{ key: 'discover', label: 'Scopri', icon: 'compass' },
					] as const
				).map(({ key, label, icon }) => (
					<TouchableOpacity
						key={key}
						style={[styles.tabItem, activeTab === key && styles.tabItemActive]}
						onPress={() => setActiveTab(key)}
					>
						<Ionicons
							name={activeTab === key ? icon : (`${icon}-outline` as any)}
							size={20}
							color={activeTab === key ? primaryColor : '#555'}
						/>
						<ThemedText
							style={[styles.tabLabel, activeTab === key && { color: primaryColor }]}
						>
							{label}
						</ThemedText>
					</TouchableOpacity>
				))}
				{/* Pulsante impostazioni */}
				<TouchableOpacity
					style={styles.tabItem}
					onPress={() => setShowSettings(true)}
				>
					<Ionicons
						name="settings-outline"
						size={20}
						color={apiKeyConfigured ? primaryColor : '#555'}
					/>
					<ThemedText style={[styles.tabLabel, apiKeyConfigured && { color: primaryColor }]}>
						API
					</ThemedText>
				</TouchableOpacity>
			</View>

			{/* ══════════════════════════════════════════════════
          TAB 1 — CERCA
      ══════════════════════════════════════════════════ */}
			{activeTab === 'search' && (
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				>
					{/* Search bar */}
					<View style={styles.searchBar}>
						<Ionicons name="search" size={18} color="#555" style={styles.searchIcon} />
						<TextInput
							style={styles.searchInput}
							placeholder="Artista, canzone, album..."
							placeholderTextColor="#444"
							value={searchQuery}
							onChangeText={handleSearchInput}
							returnKeyType="search"
							onSubmitEditing={Keyboard.dismiss}
							autoCorrect={false}
							autoCapitalize="none"
						/>
						{searchQuery.length > 0 && (
							<TouchableOpacity
								onPress={() => {
									setSearchQuery('');
									setSearchResults([]);
									setSearchError(null);
								}}
							>
								<Ionicons name="close-circle" size={18} color="#555" />
							</TouchableOpacity>
						)}
					</View>

					{/* Risultati */}
					{isSearching && (
						<View style={styles.loadingCenter}>
							<ActivityIndicator size="large" color={primaryColor} />
							<ThemedText style={styles.loadingText}>Ricerca in corso...</ThemedText>
						</View>
					)}

					{!isSearching && searchError && (
						<View style={styles.errorCenter}>
							<Ionicons name="cloud-offline-outline" size={48} color="#444" />
							<ThemedText style={styles.errorText}>{searchError}</ThemedText>
							<TouchableOpacity
								style={[styles.retryBtn, { borderColor: primaryColor }]}
								onPress={() => handleSearchInput(searchQuery)}
							>
								<ThemedText style={{ color: primaryColor, fontWeight: '600' }}>Riprova</ThemedText>
							</TouchableOpacity>
						</View>
					)}

					{!isSearching && !searchError && searchResults.length === 0 && !searchQuery && (
						<View style={styles.emptySearch}>
							<Ionicons name="search-outline" size={52} color="#222" />
							<ThemedText style={styles.emptySearchTitle}>
								Cerca musica su YouTube
							</ThemedText>
							<ThemedText style={styles.emptySearchSub}>
								Digita il nome di un artista,{'\n'}canzone o album
							</ThemedText>
						</View>
					)}

					{!isSearching && !searchError && searchResults.length === 0 && searchQuery.length > 0 && (
						<View style={styles.emptySearch}>
							<Ionicons name="musical-notes-outline" size={48} color="#333" />
							<ThemedText style={styles.emptySearchSub}>
								Nessun risultato per &quot;{searchQuery}&quot;
							</ThemedText>
						</View>
					)}

					{!isSearching && searchResults.length > 0 && (
						<FlatList
							data={searchResults}
							keyExtractor={(item) => item.id}
							contentContainerStyle={styles.listContent}
							keyboardShouldPersistTaps="handled"
							renderItem={({ item }) => (
								<TrackRow
									track={item}
									showLike
									showAddToPlaylist
								/>
							)}
						/>
					)}
				</KeyboardAvoidingView>
			)}

			{/* ══════════════════════════════════════════════════
          TAB 2 — LIBRERIA
      ══════════════════════════════════════════════════ */}
			{activeTab === 'library' && (
				<ScrollView contentContainerStyle={styles.libraryContent}>
					{/* Mi Piace */}
					<TouchableOpacity
						style={styles.libraryCard}
						onPress={() =>
							setSelectedPlaylist({ id: 'liked', name: '❤️ Mi Piace', tracks: likedSongs })
						}
						activeOpacity={0.8}
					>
						<View style={[styles.libraryCardIcon, { backgroundColor: '#2a1a1a' }]}>
							<Ionicons name="heart" size={28} color="#e74c3c" />
						</View>
						<View style={styles.libraryCardMeta}>
							<ThemedText type="defaultSemiBold" style={styles.libraryCardTitle}>
								❤️ Mi Piace
							</ThemedText>
							<ThemedText style={styles.libraryCardCount}>
								{likedSongs.length} brani
							</ThemedText>
						</View>
						<Ionicons name="chevron-forward" size={18} color="#444" />
					</TouchableOpacity>

					{/* Divider + tasto Nuova Playlist */}
					<View style={styles.librarySectionHeader}>
						<ThemedText style={styles.librarySectionTitle}>Le mie playlist</ThemedText>
						<TouchableOpacity
							onPress={() => setShowCreatePlaylist(true)}
							style={[styles.newPlaylistBtn, { borderColor: primaryColor }]}
						>
							<Ionicons name="add" size={16} color={primaryColor} />
							<ThemedText style={[styles.newPlaylistBtnText, { color: primaryColor }]}>
								Nuova
							</ThemedText>
						</TouchableOpacity>
					</View>

					{/* Lista playlist utente */}
					{userPlaylists.length === 0 ? (
						<View style={styles.emptyLibrary}>
							<Ionicons name="albums-outline" size={48} color="#222" />
							<ThemedText style={styles.emptyText}>
								Nessuna playlist ancora.{'\n'}Creane una!
							</ThemedText>
						</View>
					) : (
						userPlaylists.map((pl) => (
							<TouchableOpacity
								key={pl.id}
								style={styles.libraryCard}
								onPress={() => setSelectedPlaylist(pl)}
								onLongPress={() => handleDeletePlaylist(pl)}
								activeOpacity={0.8}
							>
								{pl.tracks.length > 0 ? (
									<Image
										source={{ uri: pl.tracks[0].thumbnail }}
										style={styles.libraryCardThumb}
									/>
								) : (
									<View style={[styles.libraryCardIcon, { backgroundColor: '#1a1a2a' }]}>
										<ThemedText style={{ fontSize: 24 }}>{pl.emoji}</ThemedText>
									</View>
								)}
								<View style={styles.libraryCardMeta}>
									<ThemedText type="defaultSemiBold" style={styles.libraryCardTitle} numberOfLines={1}>
										{pl.emoji} {pl.name}
									</ThemedText>
									<ThemedText style={styles.libraryCardCount}>
										{pl.tracks.length} brani
									</ThemedText>
								</View>
								<Ionicons name="chevron-forward" size={18} color="#444" />
							</TouchableOpacity>
						))
					)}

					<View style={{ height: 120 }} />
				</ScrollView>
			)}

			{/* ══════════════════════════════════════════════════
          TAB 3 — SCOPRI (playlist curate)
      ══════════════════════════════════════════════════ */}
			{activeTab === 'discover' && (
				<ScrollView contentContainerStyle={styles.discoverContent}>
					<ThemedText style={styles.discoverTitle}>Playlist Allenamento</ThemedText>
					<ThemedText style={styles.discoverSub}>
						Selezionate per la palestra — avvia e allena!
					</ThemedText>

					{curatedPlaylists.map((pl) => (
						<TouchableOpacity
							key={pl.id}
							style={styles.discoverCard}
							onPress={() => setSelectedPlaylist(pl)}
							activeOpacity={0.85}
						>
							<Image source={{ uri: pl.coverImage }} style={styles.discoverCardImage} />
							<View style={styles.discoverCardOverlay} />
							<View style={styles.discoverCardContent}>
								<View>
									<ThemedText style={styles.discoverCardTitle}>{pl.name}</ThemedText>
									<ThemedText style={styles.discoverCardDesc} numberOfLines={2}>
										{pl.description}
									</ThemedText>
								</View>
								<View style={[styles.discoverPlayBtn, { backgroundColor: primaryColor }]}>
									<Ionicons name="play" size={18} color="#000" />
								</View>
							</View>
						</TouchableOpacity>
					))}

					<View style={{ height: 120 }} />
				</ScrollView>
			)}

			{/* MiniPlayer persistente */}
			<MiniPlayer />

			{/* ══════════════════════════════════════════════════
          MODALE — Aggiungi a Playlist
      ══════════════════════════════════════════════════ */}
			<Modal
				visible={showAddToPlaylist}
				transparent
				animationType="slide"
				onRequestClose={() => setShowAddToPlaylist(false)}
			>
				<TouchableOpacity
					style={styles.modalBackdrop}
					activeOpacity={1}
					onPress={() => setShowAddToPlaylist(false)}
				>
					<View style={styles.bottomSheet}>
						<View style={styles.bottomSheetHandle} />
						<ThemedText type="defaultSemiBold" style={styles.bottomSheetTitle}>
							Aggiungi a playlist
						</ThemedText>
						{addToPlaylistTrack && (
							<ThemedText style={styles.bottomSheetTrack} numberOfLines={1}>
								{addToPlaylistTrack.title}
							</ThemedText>
						)}

						<ScrollView style={{ maxHeight: 300 }}>
							{userPlaylists.length === 0 ? (
								<View style={styles.emptyLibrary}>
									<ThemedText style={styles.emptyText}>
										Nessuna playlist.{'\n'}Creane una dalla tab Libreria.
									</ThemedText>
								</View>
							) : (
								userPlaylists.map((pl) => (
									<TouchableOpacity
										key={pl.id}
										style={styles.bottomSheetItem}
										onPress={() => handleAddToPlaylist(pl)}
									>
										<ThemedText style={styles.bottomSheetEmoji}>{pl.emoji}</ThemedText>
										<View style={styles.bottomSheetItemMeta}>
											<ThemedText type="defaultSemiBold">{pl.name}</ThemedText>
											<ThemedText style={styles.libraryCardCount}>
												{pl.tracks.length} brani
											</ThemedText>
										</View>
										<Ionicons name="add-circle-outline" size={22} color={primaryColor} />
									</TouchableOpacity>
								))
							)}
						</ScrollView>

						<TouchableOpacity
							style={[styles.bottomSheetNewBtn, { borderColor: primaryColor }]}
							onPress={() => {
								setShowAddToPlaylist(false);
								setTimeout(() => setShowCreatePlaylist(true), 300);
							}}
						>
							<Ionicons name="add" size={18} color={primaryColor} />
							<ThemedText style={{ color: primaryColor, fontWeight: '600' }}>
								Nuova playlist
							</ThemedText>
						</TouchableOpacity>
					</View>
				</TouchableOpacity>
			</Modal>

			{/* ══════════════════════════════════════════════════
          MODALE — Crea Nuova Playlist
      ══════════════════════════════════════════════════ */}
			<Modal
				visible={showCreatePlaylist}
				transparent
				animationType="slide"
				onRequestClose={() => setShowCreatePlaylist(false)}
			>
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				>
					<TouchableOpacity
						style={styles.modalBackdrop}
						activeOpacity={1}
						onPress={() => setShowCreatePlaylist(false)}
					>
						<View style={styles.bottomSheet}>
							<View style={styles.bottomSheetHandle} />
							<ThemedText type="defaultSemiBold" style={styles.bottomSheetTitle}>
								Nuova Playlist
							</ThemedText>

							{/* Emoji picker (semplificato) */}
							<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
								{['🎵', '🔥', '💪', '🏃', '⚡', '🤘', '🎧', '🌙', '⭐', '🏆'].map((e) => (
									<TouchableOpacity
										key={e}
										style={[
											styles.emojiBtn,
											newPlaylistEmoji === e && {
												backgroundColor: `${primaryColor}33`,
												borderColor: primaryColor,
											},
										]}
										onPress={() => setNewPlaylistEmoji(e)}
									>
										<ThemedText style={{ fontSize: 22 }}>{e}</ThemedText>
									</TouchableOpacity>
								))}
							</ScrollView>

							<TextInput
								style={styles.createPlaylistInput}
								placeholder="Nome della playlist..."
								placeholderTextColor="#444"
								value={newPlaylistName}
								onChangeText={setNewPlaylistName}
								autoFocus
								maxLength={40}
							/>

							<TouchableOpacity
								style={[styles.createPlaylistConfirm, { backgroundColor: primaryColor }]}
								onPress={handleCreatePlaylist}
							>
								<ThemedText style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>
									Crea Playlist
								</ThemedText>
							</TouchableOpacity>
						</View>
					</TouchableOpacity>
				</KeyboardAvoidingView>
			</Modal>

			{/* ══════════════════════════════════════════════════
          MODALE — Impostazioni API
      ══════════════════════════════════════════════════ */}
			<Modal
				visible={showSettings}
				transparent
				animationType="slide"
				onRequestClose={() => setShowSettings(false)}
			>
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				>
					<TouchableOpacity
						style={styles.modalBackdrop}
						activeOpacity={1}
						onPress={() => setShowSettings(false)}
					>
						<View style={styles.bottomSheet}>
							<View style={styles.bottomSheetHandle} />
							<ThemedText type="defaultSemiBold" style={styles.bottomSheetTitle}>
								Impostazioni Ricerca Musica
							</ThemedText>

							<ThemedText type="defaultSemiBold" style={[styles.bottomSheetSectionTitle, { marginTop: 8 }]}>
								Sorgente Ricerca
							</ThemedText>
							<View style={styles.providerRow}>
								<TouchableOpacity
									style={[
										styles.providerBtn,
										searchProvider === 'youtube' && { backgroundColor: primaryColor },
									]}
									onPress={() => handleSelectProvider('youtube')}
								>
									<ThemedText style={{ color: searchProvider === 'youtube' ? '#000' : '#888', fontWeight: 'bold', fontSize: 14 }}>
										YouTube
									</ThemedText>
								</TouchableOpacity>
								<TouchableOpacity
									style={[
										styles.providerBtn,
										searchProvider === 'musicbrainz' && { backgroundColor: primaryColor },
									]}
									onPress={() => handleSelectProvider('musicbrainz')}
								>
									<ThemedText style={{ color: searchProvider === 'musicbrainz' ? '#000' : '#888', fontWeight: 'bold', fontSize: 14 }}>
										MusicBrainz
									</ThemedText>
								</TouchableOpacity>
							</View>

							{searchProvider === 'youtube' && (
								<>
									<ThemedText type="defaultSemiBold" style={styles.bottomSheetSectionTitle}>
										YouTube API Key (Opzionale)
									</ThemedText>
									<ThemedText style={[styles.bottomSheetTrack, { marginBottom: 12, lineHeight: 18 }]}>
										Inserisci una chiave API YouTube v3 per ricerche più veloci ed affidabili. Se lasci vuoto, l&apos;app usa il metodo Innertube automatico.
									</ThemedText>

									<TextInput
										style={styles.createPlaylistInput}
										placeholder="Inserisci Chiave API..."
										placeholderTextColor="#444"
										value={apiKeyInput}
										onChangeText={setApiKeyInput}
										autoCorrect={false}
										autoCapitalize="none"
									/>

									<TouchableOpacity
										style={[styles.createPlaylistConfirm, { backgroundColor: primaryColor, marginBottom: 16 }]}
										onPress={handleSaveApiKey}
									>
										<ThemedText style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>
											Salva Chiave
										</ThemedText>
									</TouchableOpacity>
								</>
							)}
						</View>
					</TouchableOpacity>
				</KeyboardAvoidingView>
			</Modal>
		</ThemedView>
	);
}

// ═══════════════════════════════════════════════════════════
// STILI
// ═══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#080808' },

	// Tab bar
	tabBar: {
		flexDirection: 'row',
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: '#1e1e1e',
		backgroundColor: '#0c0c0c',
	},
	tabItem: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: 10,
		gap: 3,
	},
	tabItemActive: {},
	tabLabel: {
		fontSize: 10,
		color: '#555',
		fontWeight: '600',
	},

	// Search
	searchBar: {
		flexDirection: 'row',
		alignItems: 'center',
		margin: 12,
		backgroundColor: '#151515',
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderWidth: 1,
		borderColor: '#2a2a2a',
	},
	searchIcon: { marginRight: 8 },
	searchInput: {
		flex: 1,
		color: '#fff',
		fontSize: 15,
		padding: 0,
	},
	loadingCenter: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
	},
	loadingText: { color: '#555', fontSize: 14 },
	errorCenter: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 32,
		gap: 12,
	},
	errorText: {
		color: '#666',
		textAlign: 'center',
		lineHeight: 22,
		fontSize: 14,
	},
	retryBtn: {
		paddingHorizontal: 20,
		paddingVertical: 8,
		borderRadius: 20,
		borderWidth: 1,
		marginTop: 4,
	},
	emptySearch: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 40,
		gap: 10,
	},
	emptySearchTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginTop: 8 },
	emptySearchSub: { fontSize: 14, color: '#444', textAlign: 'center', lineHeight: 22 },
	listContent: { paddingHorizontal: 10, paddingBottom: 120 },

	// Track row
	trackRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 9,
		paddingHorizontal: 6,
		borderRadius: 10,
		marginBottom: 4,
		borderWidth: 1,
		borderColor: 'transparent',
	},
	trackRowCompact: { paddingVertical: 6 },
	thumbWrap: { position: 'relative', marginRight: 12 },
	thumb: { width: 52, height: 52, borderRadius: 6 },
	thumbOverlay: {
		...StyleSheet.absoluteFillObject,
		borderRadius: 6,
		alignItems: 'center',
		justifyContent: 'center',
	},
	trackInfo: { flex: 1, marginRight: 8 },
	trackTitle: { fontSize: 14, fontWeight: '600', color: '#e8e8e8', marginBottom: 2 },
	trackArtist: { fontSize: 12, color: '#666' },
	trackActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },

	// Library
	libraryContent: { padding: 16, paddingBottom: 120 },
	libraryCard: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#111',
		borderRadius: 12,
		padding: 12,
		marginBottom: 10,
	},
	libraryCardIcon: {
		width: 52,
		height: 52,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 12,
	},
	libraryCardThumb: {
		width: 52,
		height: 52,
		borderRadius: 10,
		marginRight: 12,
	},
	libraryCardMeta: { flex: 1 },
	libraryCardTitle: { fontSize: 15, color: '#e8e8e8', marginBottom: 3 },
	libraryCardCount: { fontSize: 12, color: '#555' },
	librarySectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 20,
		marginBottom: 12,
	},
	librarySectionTitle: { fontSize: 13, color: '#555', fontWeight: '700', letterSpacing: 0.8 },
	newPlaylistBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingVertical: 5,
		paddingHorizontal: 12,
		borderRadius: 16,
		borderWidth: 1,
	},
	newPlaylistBtnText: { fontSize: 13, fontWeight: '600' },
	emptyLibrary: {
		alignItems: 'center',
		paddingVertical: 32,
		gap: 8,
	},
	emptyText: { color: '#444', textAlign: 'center', lineHeight: 22, marginTop: 8 },

	// Detail view
	detailHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingTop: 8,
		paddingBottom: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: '#1e1e1e',
	},
	backBtn: { padding: 6, width: 40 },
	detailHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 15, color: '#ccc' },
	detailHeroSection: {
		flexDirection: 'row',
		padding: 16,
		gap: 16,
		alignItems: 'center',
	},
	detailCoverGrid: { width: 110, height: 110, borderRadius: 12, overflow: 'hidden' },
	detailCoverSingle: { width: '100%', height: '100%' },
	detailCoverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
	detailCoverGridInner: {
		flex: 1,
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	detailCoverQuarter: { width: '50%', height: '50%' },
	detailHeroMeta: { flex: 1, gap: 6 },
	detailName: { fontSize: 18, fontWeight: '700', color: '#fff' },
	detailCount: { fontSize: 13, color: '#666' },
	playAllBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingVertical: 8,
		paddingHorizontal: 18,
		borderRadius: 20,
		alignSelf: 'flex-start',
		marginTop: 4,
	},
	playAllBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
	emptyPlaylist: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
		padding: 40,
	},

	// Discover
	discoverContent: { padding: 16, paddingBottom: 120 },
	discoverTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
	discoverSub: { fontSize: 13, color: '#555', marginBottom: 20 },
	discoverCard: {
		height: 140,
		borderRadius: 16,
		overflow: 'hidden',
		marginBottom: 16,
		position: 'relative',
	},
	discoverCardImage: {
		...StyleSheet.absoluteFillObject,
		resizeMode: 'cover',
	},
	discoverCardOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0,0,0,0.55)',
	},
	discoverCardContent: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: 16,
	},
	discoverCardTitle: {
		fontSize: 18,
		fontWeight: '800',
		color: '#fff',
		marginBottom: 4,
		textShadowColor: '#000',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 4,
	},
	discoverCardDesc: {
		fontSize: 12,
		color: '#ccc',
		maxWidth: '70%',
		lineHeight: 17,
	},
	discoverPlayBtn: {
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: 'center',
		justifyContent: 'center',
		elevation: 4,
	},

	// Modali
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.65)',
		justifyContent: 'flex-end',
	},
	bottomSheet: {
		backgroundColor: '#121212',
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		paddingHorizontal: 20,
		paddingBottom: 40,
		paddingTop: 12,
	},
	bottomSheetHandle: {
		width: 36,
		height: 4,
		backgroundColor: '#333',
		borderRadius: 2,
		alignSelf: 'center',
		marginBottom: 16,
	},
	bottomSheetTitle: { fontSize: 17, color: '#fff', marginBottom: 4 },
	bottomSheetTrack: { fontSize: 13, color: '#666', marginBottom: 16 },
	bottomSheetItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: '#1e1e1e',
	},
	bottomSheetEmoji: { fontSize: 22, marginRight: 12 },
	bottomSheetItemMeta: { flex: 1 },
	bottomSheetNewBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		marginTop: 16,
		paddingVertical: 12,
		borderRadius: 12,
		borderWidth: 1,
	},
	emojiRow: { marginBottom: 16 },
	emojiBtn: {
		padding: 8,
		marginRight: 8,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: 'transparent',
	},
	createPlaylistInput: {
		backgroundColor: '#1a1a1a',
		borderWidth: 1,
		borderColor: '#2a2a2a',
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		color: '#fff',
		fontSize: 16,
		marginBottom: 16,
	},
	createPlaylistConfirm: {
		paddingVertical: 14,
		borderRadius: 12,
		alignItems: 'center',
	},
	bottomSheetSectionTitle: {
		fontSize: 14,
		color: '#aaa',
		marginBottom: 8,
	},
	providerRow: {
		flexDirection: 'row',
		backgroundColor: '#1a1a1a',
		borderRadius: 12,
		padding: 4,
		marginBottom: 20,
		gap: 4,
	},
	providerBtn: {
		flex: 1,
		paddingVertical: 10,
		alignItems: 'center',
		borderRadius: 8,
	},
});
