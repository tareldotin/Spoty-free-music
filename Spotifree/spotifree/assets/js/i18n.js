/* ==========================================================================
   i18n.js — English / Malayalam / Hindi / Tamil
   Missing strings fall back to English.
   ========================================================================== */

const EN = {
  home:'Home', search:'Search', library:'Library', settings:'Settings', import:'Import',
  goodMorning:'Good morning', goodAfternoon:'Good afternoon', goodEvening:'Good evening',
  quickPicks:'Quick picks', recentlyPlayed:'Recently played', mostPlayed:'Most played',
  recentlyAdded:'Recently added', likedSongs:'Liked songs', trending:'Trending music',
  seeAll:'See all', playlists:'Playlists', songs:'Songs', all:'All',

  play:'Play', pause:'Pause', next:'Next', previous:'Previous',
  shuffle:'Shuffle', shuffleOn:'Shuffle on', shuffleOff:'Shuffle off',
  repeat:'Repeat', repeatOff:'Repeat off', repeatAll:'Repeat all', repeatOne:'Repeat one',
  queue:'Queue', nowPlaying:'Now playing', upNext:'Up next', clearQueue:'Clear queue',
  removeFromQueue:'Remove from queue', playNext:'Play next',

  addToPlaylist:'Add to playlist', newPlaylist:'New playlist', create:'Create',
  rename:'Rename', delete:'Delete', duplicate:'Duplicate', merge:'Merge into…',
  mergeInto:'Merge into', removeFromPlaylist:'Remove from this playlist',

  sleepTimer:'Sleep timer', off:'Off', endOfSong:'End of song', min15:'15 minutes',
  min30:'30 minutes', min45:'45 minutes', hour1:'1 hour',
  equalizer:'Equalizer', dataSaver:'Data saver', clearCache:'Clear cache',
  exportData:'Export backup', importData:'Import backup', language:'Language',
  theme:'Theme', dark:'Dark', light:'Light', accentColor:'Accent color',
  crossfade:'Crossfade', autoplaySimilar:'Auto-play similar',
  notifications:'Notifications', install:'Install app',

  offline:'Offline', online:'Back online', offlineMsg:'Metadata is cached — playback needs a connection.',
  searchYoutube:'Search YouTube', searchHistory:'Recent searches', clearHistory:'Clear',
  noResults:'No results', typeToSearch:'Search for songs, playlists or channels',
  pasteLinks:'Paste YouTube links', pasteHint:'One link per line — playlist, video or channel',
  importBtn:'Import', importing:'Importing…', importDone:'Imported',

  sortBy:'Sort by', titleAZ:'Title A–Z', titleZA:'Title Z–A', duration:'Duration', dateAdded:'Date added',
  cancel:'Cancel', save:'Save', done:'Done', name:'Name', yes:'Yes', no:'No',
  emptyLibrary:'Your library is empty', emptyLibraryMsg:'Paste a YouTube playlist link to get started.',
  emptyLiked:'No liked songs yet', emptyLikedMsg:'Tap the heart while a song plays to save it here.',
  emptyQueue:'Nothing in the queue',
  playbackError:'This video can’t be played here', skipping:'Skipping…',
  badLink:'That link wasn’t recognised', networkError:'Network problem',
  cleared:'Cache cleared', exported:'Backup downloaded', imported:'Backup restored',
  created:'Playlist created', deleted:'Deleted', renamed:'Renamed',
  added:'Added', removed:'Removed', copied:'Duplicated', merged:'Merged',
  apiKeyTitle:'YouTube Data API key', apiKeyDesc:'Optional. Without it SpotiFree reads public pages through CORS proxies.',
  appearance:'Appearance', playback:'Playback', data:'Data & storage', about:'About',
  dataSource:'Data source', test:'Test', working:'Working', failed:'Failed',
  songsCount:'{n} songs', songsOne:'1 song',
  like:'Like', unlike:'Unlike',
  jumpBackIn:'Jump back in', madeForYou:'Made for you', moreLikeThis:'More like this',
  version:'Version', storageUsed:'Storage used', wipe:'Erase everything',
  wipeConfirm:'This deletes every playlist, like and history entry on this device. Continue?',
  swipeHint:'Swipe to change songs', pullRefresh:'Pull to refresh',
};

const ML = {
  home:'ഹോം', search:'തിരയുക', library:'ലൈബ്രറി', settings:'ക്രമീകരണങ്ങൾ', import:'ഇറക്കുമതി',
  goodMorning:'സുപ്രഭാതം', goodAfternoon:'ശുഭമദ്ധ്യാഹ്നം', goodEvening:'ശുഭസന്ധ്യ',
  quickPicks:'പെട്ടെന്നുള്ള തിരഞ്ഞെടുപ്പുകൾ', recentlyPlayed:'അടുത്തിടെ കേട്ടവ',
  mostPlayed:'ഏറ്റവും കേട്ടവ', recentlyAdded:'പുതുതായി ചേർത്തവ',
  likedSongs:'ഇഷ്ടപ്പെട്ട പാട്ടുകൾ', trending:'ട്രെൻഡിംഗ്', seeAll:'എല്ലാം കാണുക',
  playlists:'പ്ലേലിസ്റ്റുകൾ', songs:'പാട്ടുകൾ', all:'എല്ലാം',
  play:'പ്ലേ ചെയ്യുക', pause:'നിർത്തുക', next:'അടുത്തത്', previous:'മുമ്പത്തേത്',
  shuffle:'ഷഫിൾ', shuffleOn:'ഷഫിൾ ഓൺ', shuffleOff:'ഷഫിൾ ഓഫ്',
  repeat:'ആവർത്തനം', repeatOff:'ആവർത്തനം ഓഫ്', repeatAll:'എല്ലാം ആവർത്തിക്കുക', repeatOne:'ഒന്ന് ആവർത്തിക്കുക',
  queue:'ക്യൂ', nowPlaying:'ഇപ്പോൾ പ്ലേ ചെയ്യുന്നു', upNext:'അടുത്തതായി',
  clearQueue:'ക്യൂ മായ്ക്കുക', removeFromQueue:'ക്യൂവിൽ നിന്ന് നീക്കുക', playNext:'അടുത്തതായി പ്ലേ ചെയ്യുക',
  addToPlaylist:'പ്ലേലിസ്റ്റിലേക്ക് ചേർക്കുക', newPlaylist:'പുതിയ പ്ലേലിസ്റ്റ്', create:'ഉണ്ടാക്കുക',
  rename:'പേര് മാറ്റുക', delete:'ഇല്ലാതാക്കുക', duplicate:'പകർപ്പ്', merge:'ചേർക്കുക',
  mergeInto:'ഇതിലേക്ക് ചേർക്കുക', removeFromPlaylist:'ഈ പ്ലേലിസ്റ്റിൽ നിന്ന് നീക്കുക',
  sleepTimer:'സ്ലീപ്പ് ടൈമർ', off:'ഓഫ്', endOfSong:'പാട്ട് കഴിയുമ്പോൾ',
  min15:'15 മിനിറ്റ്', min30:'30 മിനിറ്റ്', min45:'45 മിനിറ്റ്', hour1:'1 മണിക്കൂർ',
  equalizer:'ഇക്വലൈസർ', dataSaver:'ഡാറ്റ സേവർ', clearCache:'കാഷെ മായ്ക്കുക',
  exportData:'ബാക്കപ്പ് എക്സ്പോർട്ട്', importData:'ബാക്കപ്പ് ഇറക്കുമതി', language:'ഭാഷ',
  theme:'തീം', dark:'ഇരുണ്ട', light:'വെളിച്ചം', accentColor:'ആക്സന്റ് നിറം',
  crossfade:'ക്രോസ്ഫേഡ്', autoplaySimilar:'സമാന പാട്ടുകൾ സ്വയം പ്ലേ',
  notifications:'അറിയിപ്പുകൾ', install:'ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക',
  offline:'ഓഫ്‌ലൈൻ', online:'വീണ്ടും ഓൺലൈൻ',
  offlineMsg:'വിവരങ്ങൾ സേവ് ചെയ്തിട്ടുണ്ട് — പ്ലേ ചെയ്യാൻ ഇന്റർനെറ്റ് വേണം.',
  searchYoutube:'YouTube-ൽ തിരയുക', searchHistory:'അടുത്ത തിരച്ചിലുകൾ', clearHistory:'മായ്ക്കുക',
  noResults:'ഫലങ്ങളൊന്നുമില്ല', typeToSearch:'പാട്ടുകൾ, പ്ലേലിസ്റ്റുകൾ, ചാനലുകൾ തിരയുക',
  pasteLinks:'YouTube ലിങ്കുകൾ പേസ്റ്റ് ചെയ്യുക',
  pasteHint:'ഒരു വരിയിൽ ഒരു ലിങ്ക് — പ്ലേലിസ്റ്റ്, പാട്ട് അല്ലെങ്കിൽ ചാനൽ',
  importBtn:'ഇറക്കുമതി', importing:'ഇറക്കുമതി ചെയ്യുന്നു…', importDone:'ചേർത്തു',
  sortBy:'അടുക്കുക', titleAZ:'പേര് A–Z', titleZA:'പേര് Z–A', duration:'ദൈർഘ്യം', dateAdded:'ചേർത്ത തീയതി',
  cancel:'റദ്ദാക്കുക', save:'സേവ് ചെയ്യുക', done:'കഴിഞ്ഞു', name:'പേര്',
  emptyLibrary:'ലൈബ്രറി ശൂന്യമാണ്', emptyLibraryMsg:'ഒരു YouTube പ്ലേലിസ്റ്റ് ലിങ്ക് പേസ്റ്റ് ചെയ്ത് തുടങ്ങൂ.',
  emptyLiked:'ഇഷ്ടപ്പെട്ട പാട്ടുകളില്ല', emptyLikedMsg:'പാട്ട് പ്ലേ ചെയ്യുമ്പോൾ ഹൃദയം അമർത്തി സേവ് ചെയ്യൂ.',
  emptyQueue:'ക്യൂവിൽ ഒന്നുമില്ല',
  playbackError:'ഈ വീഡിയോ ഇവിടെ പ്ലേ ചെയ്യാനാവില്ല', skipping:'ഒഴിവാക്കുന്നു…',
  badLink:'ആ ലിങ്ക് മനസ്സിലായില്ല', networkError:'നെറ്റ്‌വർക്ക് പ്രശ്നം',
  cleared:'കാഷെ മായ്ച്ചു', exported:'ബാക്കപ്പ് ഡൗൺലോഡ് ചെയ്തു', imported:'ബാക്കപ്പ് പുനഃസ്ഥാപിച്ചു',
  created:'പ്ലേലിസ്റ്റ് ഉണ്ടാക്കി', deleted:'ഇല്ലാതാക്കി', renamed:'പേര് മാറ്റി',
  added:'ചേർത്തു', removed:'നീക്കി', copied:'പകർത്തി', merged:'ചേർത്തു',
  apiKeyTitle:'YouTube Data API കീ', apiKeyDesc:'ഓപ്ഷണൽ. ഇല്ലെങ്കിൽ SpotiFree പൊതു പേജുകൾ CORS പ്രോക്സി വഴി വായിക്കും.',
  appearance:'രൂപം', playback:'പ്ലേബാക്ക്', data:'ഡാറ്റയും സ്റ്റോറേജും', about:'കുറിച്ച്',
  dataSource:'ഡാറ്റ സ്രോതസ്സ്', test:'പരിശോധിക്കുക', working:'പ്രവർത്തിക്കുന്നു', failed:'പരാജയപ്പെട്ടു',
  songsCount:'{n} പാട്ടുകൾ', songsOne:'1 പാട്ട്',
  like:'ഇഷ്ടപ്പെടുക', unlike:'ഇഷ്ടം നീക്കുക',
  jumpBackIn:'വീണ്ടും കേൾക്കാം', madeForYou:'നിങ്ങൾക്കായി', moreLikeThis:'ഇതുപോലുള്ളവ',
  version:'പതിപ്പ്', storageUsed:'ഉപയോഗിച്ച സ്റ്റോറേജ്', wipe:'എല്ലാം മായ്ക്കുക',
  wipeConfirm:'ഈ ഉപകരണത്തിലെ എല്ലാ പ്ലേലിസ്റ്റുകളും ഇഷ്ടങ്ങളും ചരിത്രവും മായ്ക്കും. തുടരണോ?',
  swipeHint:'പാട്ട് മാറ്റാൻ സ്വൈപ്പ് ചെയ്യുക', pullRefresh:'പുതുക്കാൻ വലിക്കുക',
};

const HI = {
  home:'होम', search:'खोजें', library:'लाइब्रेरी', settings:'सेटिंग्स', import:'आयात',
  goodMorning:'सुप्रभात', goodAfternoon:'नमस्कार', goodEvening:'शुभ संध्या',
  quickPicks:'त्वरित चयन', recentlyPlayed:'हाल ही में सुना', mostPlayed:'सबसे ज्यादा सुना',
  recentlyAdded:'हाल ही में जोड़ा', likedSongs:'पसंदीदा गाने', trending:'ट्रेंडिंग संगीत',
  seeAll:'सब देखें', playlists:'प्लेलिस्ट', songs:'गाने', all:'सभी',
  play:'चलाएँ', pause:'रोकें', next:'अगला', previous:'पिछला',
  shuffle:'शफ़ल', shuffleOn:'शफ़ल चालू', shuffleOff:'शफ़ल बंद',
  repeat:'दोहराएँ', repeatOff:'दोहराना बंद', repeatAll:'सब दोहराएँ', repeatOne:'एक दोहराएँ',
  queue:'कतार', nowPlaying:'अब चल रहा है', upNext:'आगे', clearQueue:'कतार खाली करें',
  removeFromQueue:'कतार से हटाएँ', playNext:'अगला चलाएँ',
  addToPlaylist:'प्लेलिस्ट में जोड़ें', newPlaylist:'नई प्लेलिस्ट', create:'बनाएँ',
  rename:'नाम बदलें', delete:'हटाएँ', duplicate:'डुप्लिकेट', merge:'मिलाएँ',
  mergeInto:'इसमें मिलाएँ', removeFromPlaylist:'इस प्लेलिस्ट से हटाएँ',
  sleepTimer:'स्लीप टाइमर', off:'बंद', endOfSong:'गाना खत्म होने पर',
  min15:'15 मिनट', min30:'30 मिनट', min45:'45 मिनट', hour1:'1 घंटा',
  equalizer:'इक्वेलाइज़र', dataSaver:'डेटा सेवर', clearCache:'कैश साफ़ करें',
  exportData:'बैकअप निर्यात', importData:'बैकअप आयात', language:'भाषा',
  theme:'थीम', dark:'डार्क', light:'लाइट', accentColor:'एक्सेंट रंग',
  crossfade:'क्रॉसफ़ेड', autoplaySimilar:'इस जैसे गाने अपने-आप चलाएँ',
  notifications:'सूचनाएँ', install:'ऐप इंस्टॉल करें',
  offline:'ऑफ़लाइन', online:'फिर ऑनलाइन', offlineMsg:'जानकारी सहेजी है — चलाने के लिए इंटरनेट चाहिए।',
  searchYoutube:'YouTube खोजें', searchHistory:'हाल की खोजें', clearHistory:'साफ़ करें',
  noResults:'कोई परिणाम नहीं', typeToSearch:'गाने, प्लेलिस्ट या चैनल खोजें',
  pasteLinks:'YouTube लिंक पेस्ट करें', pasteHint:'एक लाइन में एक लिंक — प्लेलिस्ट, गाना या चैनल',
  importBtn:'आयात', importing:'आयात हो रहा है…', importDone:'जोड़ा गया',
  sortBy:'क्रमबद्ध करें', titleAZ:'नाम A–Z', titleZA:'नाम Z–A', duration:'लंबाई', dateAdded:'जोड़ने की तारीख',
  cancel:'रद्द करें', save:'सहेजें', done:'हो गया', name:'नाम',
  emptyLibrary:'लाइब्रेरी खाली है', emptyLibraryMsg:'शुरू करने के लिए एक YouTube प्लेलिस्ट लिंक पेस्ट करें।',
  emptyLiked:'अभी कोई पसंदीदा गाना नहीं', emptyLikedMsg:'गाना चलते समय दिल दबाकर इसे यहाँ सहेजें।',
  emptyQueue:'कतार खाली है',
  playbackError:'यह वीडियो यहाँ नहीं चल सकता', skipping:'छोड़ा जा रहा है…',
  badLink:'यह लिंक समझ नहीं आया', networkError:'नेटवर्क समस्या',
  cleared:'कैश साफ़ हुआ', exported:'बैकअप डाउनलोड हुआ', imported:'बैकअप बहाल हुआ',
  created:'प्लेलिस्ट बनी', deleted:'हटाया गया', renamed:'नाम बदला गया',
  added:'जोड़ा गया', removed:'हटाया गया', copied:'डुप्लिकेट बना', merged:'मिला दिया',
  apiKeyTitle:'YouTube Data API कुंजी', apiKeyDesc:'वैकल्पिक। इसके बिना SpotiFree CORS प्रॉक्सी से सार्वजनिक पेज पढ़ता है।',
  appearance:'रूप', playback:'प्लेबैक', data:'डेटा और स्टोरेज', about:'परिचय',
  dataSource:'डेटा स्रोत', test:'जाँचें', working:'चालू', failed:'विफल',
  songsCount:'{n} गाने', songsOne:'1 गाना',
  like:'पसंद करें', unlike:'पसंद हटाएँ',
  jumpBackIn:'फिर सुनें', madeForYou:'आपके लिए', moreLikeThis:'इस जैसे और',
  version:'संस्करण', storageUsed:'इस्तेमाल हुई स्टोरेज', wipe:'सब मिटाएँ',
  wipeConfirm:'इस डिवाइस की सारी प्लेलिस्ट, पसंद और इतिहास मिट जाएगा। जारी रखें?',
  swipeHint:'गाना बदलने के लिए स्वाइप करें', pullRefresh:'रीफ़्रेश करने के लिए खींचें',
};

const TA = {
  home:'முகப்பு', search:'தேடு', library:'நூலகம்', settings:'அமைப்புகள்', import:'இறக்குமதி',
  goodMorning:'காலை வணக்கம்', goodAfternoon:'மதிய வணக்கம்', goodEvening:'மாலை வணக்கம்',
  quickPicks:'விரைவுத் தேர்வுகள்', recentlyPlayed:'சமீபத்தில் கேட்டவை',
  mostPlayed:'அதிகம் கேட்டவை', recentlyAdded:'புதிதாகச் சேர்க்கப்பட்டவை',
  likedSongs:'விருப்பப் பாடல்கள்', trending:'டிரெண்டிங் இசை', seeAll:'அனைத்தும் காண',
  playlists:'பிளேலிஸ்ட்கள்', songs:'பாடல்கள்', all:'அனைத்தும்',
  play:'இயக்கு', pause:'நிறுத்து', next:'அடுத்தது', previous:'முந்தையது',
  shuffle:'கலக்கு', shuffleOn:'கலக்கல் இயக்கம்', shuffleOff:'கலக்கல் நிறுத்தம்',
  repeat:'மீண்டும்', repeatOff:'மீண்டும் இல்லை', repeatAll:'அனைத்தும் மீண்டும்', repeatOne:'ஒன்றை மீண்டும்',
  queue:'வரிசை', nowPlaying:'இப்போது இயங்குகிறது', upNext:'அடுத்து',
  clearQueue:'வரிசையை அழி', removeFromQueue:'வரிசையில் இருந்து நீக்கு', playNext:'அடுத்து இயக்கு',
  addToPlaylist:'பிளேலிஸ்டில் சேர்', newPlaylist:'புதிய பிளேலிஸ்ட்', create:'உருவாக்கு',
  rename:'பெயர் மாற்று', delete:'நீக்கு', duplicate:'நகலெடு', merge:'இணை',
  mergeInto:'இதில் இணை', removeFromPlaylist:'இந்த பிளேலிஸ்டில் இருந்து நீக்கு',
  sleepTimer:'ஸ்லீப் டைமர்', off:'ஆஃப்', endOfSong:'பாடல் முடிந்ததும்',
  min15:'15 நிமிடம்', min30:'30 நிமிடம்', min45:'45 நிமிடம்', hour1:'1 மணி',
  equalizer:'ஈக்வலைசர்', dataSaver:'தரவு சேமிப்பு', clearCache:'கேஷ் அழி',
  exportData:'காப்புப்பிரதி ஏற்றுமதி', importData:'காப்புப்பிரதி இறக்குமதி', language:'மொழி',
  theme:'தீம்', dark:'இருண்ட', light:'வெளிர்', accentColor:'முக்கிய நிறம்',
  crossfade:'க்ராஸ்ஃபேட்', autoplaySimilar:'இதுபோன்ற பாடல்களை தானே இயக்கு',
  notifications:'அறிவிப்புகள்', install:'ஆப் நிறுவு',
  offline:'ஆஃப்லைன்', online:'மீண்டும் ஆன்லைன்', offlineMsg:'தகவல் சேமிக்கப்பட்டது — இயக்க இணையம் தேவை.',
  searchYoutube:'YouTube இல் தேடு', searchHistory:'சமீபத்திய தேடல்கள்', clearHistory:'அழி',
  noResults:'முடிவுகள் இல்லை', typeToSearch:'பாடல்கள், பிளேலிஸ்ட்கள் அல்லது சேனல்களைத் தேடு',
  pasteLinks:'YouTube இணைப்புகளை ஒட்டு',
  pasteHint:'ஒரு வரிக்கு ஒரு இணைப்பு — பிளேலிஸ்ட், பாடல் அல்லது சேனல்',
  importBtn:'இறக்குமதி', importing:'இறக்குமதி ஆகிறது…', importDone:'சேர்க்கப்பட்டது',
  sortBy:'வரிசைப்படுத்து', titleAZ:'பெயர் A–Z', titleZA:'பெயர் Z–A', duration:'நீளம்', dateAdded:'சேர்க்கப்பட்ட தேதி',
  cancel:'ரத்து', save:'சேமி', done:'முடிந்தது', name:'பெயர்',
  emptyLibrary:'உங்கள் நூலகம் காலியாக உள்ளது',
  emptyLibraryMsg:'தொடங்க ஒரு YouTube பிளேலிஸ்ட் இணைப்பை ஒட்டவும்.',
  emptyLiked:'விருப்பப் பாடல்கள் இல்லை',
  emptyLikedMsg:'பாடல் இயங்கும் போது இதயத்தை அழுத்தி இங்கே சேமிக்கவும்.',
  emptyQueue:'வரிசையில் ஒன்றுமில்லை',
  playbackError:'இந்த வீடியோ இங்கே இயங்காது', skipping:'தவிர்க்கப்படுகிறது…',
  badLink:'அந்த இணைப்பு புரியவில்லை', networkError:'பிணையச் சிக்கல்',
  cleared:'கேஷ் அழிக்கப்பட்டது', exported:'காப்புப்பிரதி பதிவிறக்கம் ஆனது', imported:'காப்புப்பிரதி மீட்கப்பட்டது',
  created:'பிளேலிஸ்ட் உருவாக்கப்பட்டது', deleted:'நீக்கப்பட்டது', renamed:'பெயர் மாற்றப்பட்டது',
  added:'சேர்க்கப்பட்டது', removed:'நீக்கப்பட்டது', copied:'நகலெடுக்கப்பட்டது', merged:'இணைக்கப்பட்டது',
  apiKeyTitle:'YouTube Data API விசை',
  apiKeyDesc:'விருப்பம். இல்லையெனில் SpotiFree பொதுப் பக்கங்களை CORS ப்ராக்ஸி வழி படிக்கும்.',
  appearance:'தோற்றம்', playback:'இயக்கம்', data:'தரவும் சேமிப்பும்', about:'பற்றி',
  dataSource:'தரவு மூலம்', test:'சோதி', working:'இயங்குகிறது', failed:'தோல்வி',
  songsCount:'{n} பாடல்கள்', songsOne:'1 பாடல்',
  like:'விரும்பு', unlike:'விருப்பத்தை நீக்கு',
  jumpBackIn:'மீண்டும் கேட்போம்', madeForYou:'உங்களுக்காக', moreLikeThis:'இதுபோன்ற மேலும்',
  version:'பதிப்பு', storageUsed:'பயன்படுத்திய சேமிப்பு', wipe:'அனைத்தையும் அழி',
  wipeConfirm:'இந்த சாதனத்தில் உள்ள எல்லா பிளேலிஸ்ட்கள், விருப்பங்கள் மற்றும் வரலாறும் அழிக்கப்படும். தொடரவா?',
  swipeHint:'பாடலை மாற்ற சுவைப் செய்யவும்', pullRefresh:'புதுப்பிக்க இழுக்கவும்',
};

export const LANGS = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

const DICTS = { en: EN, ml: ML, hi: HI, ta: TA };

let current = localStorage.getItem('spotifree.lang') || 'en';
if (!DICTS[current]) current = 'en';

export const getLang = () => current;
export const setLang = (code) => {
  current = DICTS[code] ? code : 'en';
  localStorage.setItem('spotifree.lang', current);
  document.documentElement.lang = current;
  applyI18n();
};

export function t(key, vars) {
  const dict = DICTS[current] || EN;
  let s = dict[key] ?? EN[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  return s;
}

/** Replace text of every element carrying data-i18n. */
export function applyI18n(root = document) {
  for (const n of root.querySelectorAll('[data-i18n]')) {
    const v = t(n.dataset.i18n);
    if (n.dataset.i18nSuffix) n.textContent = v + n.dataset.i18nSuffix;
    else n.textContent = v;
  }
  for (const n of root.querySelectorAll('[data-i18n-ph]')) n.placeholder = t(n.dataset.i18nPh);
  for (const n of root.querySelectorAll('[data-i18n-aria]')) n.setAttribute('aria-label', t(n.dataset.i18nAria));
}
