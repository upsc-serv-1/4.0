export interface ModelAnswer {
  introduction: string;
  bodyPoints: {
    heading: string;
    bullets: string[];
  }[];
  conclusion: string;
}

export interface Question {
  id: number;
  title: string;
  paper: string;
  subject: string;
  sectionGroup?: string;
  section?: string;
  subTopic: string;
  wordLimit: number;
  year: number;
  institute: string;
  isPyq: boolean;
  modelAnswer?: ModelAnswer;
}

export interface ValueAdditionItem {
  id: string;
  category: "data_facts" | "intro_conclusion" | "quotes" | "mnemonics" | "frameworks" | "ethics";
  paper?: string;
  subject?: string;
  sectionGroup?: string;
  microtopic?: string;
  subtopic?: string;
  title: string;
  metric?: string;
  context?: string;
  source?: string;
  introduction?: string;
  conclusion?: string;
  quoteText?: string;
  author?: string;
  usageGuide?: string;
  mnemonicKeyword?: string;
  mnemonicExpansion?: { letter: string; meaning: string; detail?: string }[];
  frameworkBoxes?: { label: string; description: string }[];
  frameworkGuide?: string;
  ethicsType?: "diagram" | "dimension" | "comparison" | "innovation" | "pyq_quote" | "keyword";
  ethicsData?: {
    diagramType?: string;
    diagramDescription?: string;
    dimensionsList?: string[];
    comparisonPoints?: { criteria: string; termA: string; termB: string }[];
    columnHeaders?: { col1: string; col2: string; col3: string };
    comparisonNonTableContent?: string;
    officerName?: string;
    initiative?: string;
    impact?: string;
    values?: string;
    keywordDefinition?: string;
    keywordExample?: string;
    diagramsList?: { title: string; imagePath: string }[];
  };
  rawContent?: string;
  diagramImagePath?: string;
  hierarchies?: any[];
  hierarchy_1_path?: string[] | null;
  hierarchy_2_path?: string[] | null;
  hierarchy_3_path?: string[] | null;
  hierarchy_4_path?: string[] | null;
  hierarchy_5_path?: string[] | null;
  [key: string]: any;
  examples?: string;
  data_points?: string;
}

export const mockQuestions: Question[] = [
  {
    id: 1,
    title: "Discuss the role of the Election Commission of India in the light of the evolution of the Model Code of Conduct.",
    paper: "GS2",
    subject: "Polity",
    sectionGroup: "Governance & Administration",
    section: "Centre-State Relations",
    subTopic: "Model Code of Conduct",
    wordLimit: 250,
    year: 2022,
    institute: "UPSC Official",
    isPyq: true,
    modelAnswer: {
      introduction: "The Election Commission of India (ECI) has evolved the Model Code of Conduct (MCC) from a voluntary consensus among political parties in 1960 to a powerful administrative instrument to ensure free and fair elections under Article 324 of the Constitution.",
      bodyPoints: [
        {
          heading: "Evolution and Efficacy of the MCC",
          bullets: [
            "Began in Kerala local assembly elections (1960) and later adopted by consensus in 1968 for Lok Sabha elections.",
            "Operates without statutory backing, allowing ECI to respond dynamically without judicial delays, acting as an administrative moral compass.",
            "Supreme Court in S. Subramaniam Balaji (2013) upheld that ECI's guidelines are vital for maintaining level playing fields."
          ]
        },
        {
          heading: "Key Roles Played by ECI via MCC",
          bullets: [
            "Prevents partisan abuse of state machinery by ruling parties (e.g. restrictions on advertising, announcing schemes post-election dates).",
            "Curbing hate speech and communal polarization using modern tech like C-Vigil app for real-world reporting.",
            "Regulating social media and digital campaigning under ECI's Voluntary Code of Ethics since 2019."
          ]
        },
        {
          heading: "Modern Challenges and Reforms",
          bullets: [
            "Rise of online propaganda, hate speech on encrypted networks, and fake news which bypass traditional MCC guidelines.",
            "Controversy over 'freebie' distributions and ECI's efforts to seek transparency in party poll-expenditure manifestos.",
            "Debate over giving legal backing to MCC; ECI opposes this as it would drag code violations to courts, delaying quick enforcement."
          ]
        }
      ],
      conclusion: "Therefore, ECI's stewardship of the MCC illustrates how moral consensus, when backed by constitutional authority under Article 324, can build a resilient democratic fabric that adapts to technological and political challenges."
    }
  },
  {
    id: 6,
    title: "The Bhakti movement received a remarkable re-orientation with the advent of Sri Chaitanya Mahaprabhu. Discuss.",
    paper: "GS1",
    subject: "History",
    sectionGroup: "Art and Culture",
    section: "Indian Culture — Salient Aspects",
    subTopic: "Bhakti and Sufi movement",
    wordLimit: 150,
    year: 2018,
    institute: "UPSC Official",
    isPyq: true,
    modelAnswer: {
      introduction: "Sri Chaitanya Mahaprabhu (1486–1534) re-oriented the Bhakti movement in Eastern India by transforming it from a quietist philosophical pursuit into an ecstatic, popular, and socially egalitarian mass movement centered on 'Gaudiya Vaishnavism'.",
      bodyPoints: [
        {
          heading: "Key Re-orientations Introduced by Sri Chaitanya",
          bullets: [
            "**Sankirtan Movement**: Shifted spiritual practice from solitary temples to public streets through congregational chanting of Hari's name, breaking social barriers.",
            "**Egalitarian Inclusivity**: Welcomed people of all castes, genders, and faiths (e.g., Haridas, born Muslim, became a chief disciple), defying orthodox Brahmanical hierarchies.",
            "**Emotional Devotion (Prema Bhakti)**: Promoted the concept of ecstatic love for Krishna, viewing the soul's union with god through intense emotional expression (music and dance)."
          ]
        },
        {
          heading: "Socio-Cultural Impact",
          bullets: [
            "Provided a strong foundation for regional languages, especially Bengali and Assamese, through literature, kirtans, and theatrical plays (Ankia Naat).",
            "Fostered deep inter-faith communal harmony, creating shared spiritual platforms that remain active in modern times (e.g. ISKCON tradition)."
          ]
        }
      ],
      conclusion: "Ultimately, Chaitanya Mahaprabhu's spiritual revolution democratized medieval society, transforming religious devotion into a vital tool for social equality and universal brotherhood."
    }
  },
  {
    id: 9,
    title: "Apart from intellectual competency and moral qualities, empathy and compassion are some of the other vital attributes that facilitate civil servants to tackle crucial issues or take critical decisions. Explain with suitable illustrations.",
    paper: "GS4",
    subject: "Ethics",
    sectionGroup: "Foundational Values",
    section: "Ethics in Public Life",
    subTopic: "Empathy and Compassion",
    wordLimit: 150,
    year: 2022,
    institute: "UPSC Official",
    isPyq: true,
    modelAnswer: {
      introduction: "While intelligence and moral uprightness ensure legality and honesty, empathy and compassion bridge the gap between administrative rules and human realities, allowing civil servants to serve marginalized groups effectively.",
      bodyPoints: [
        {
          heading: "Empathy vs. Compassion in Administration",
          bullets: [
            "**Empathy** is understanding the pain of citizens (e.g. seeing a poor widow struggling without an Aadhaar card for pension).",
            "**Compassion** translates that understanding into action, finding creative, legal solutions to relieve their distress."
          ]
        },
        {
          heading: "Key Illustrations of Compassionate Leadership",
          bullets: [
            "**Armstrong Pame (IAS)**: Witnessed the suffering of villagers traveling hours due to lack of a road, leading him to crowdfund a 100km 'People's Road' without waiting for slow state funds.",
            "**Prasanth Nair (IAS)**: Started 'Operation Sulaimani' in Kozhikode to ensure free meals with dignity through restaurant coupons, addressing urban hunger compassionately.",
            "**Jitendra Kumar Soni (IAS)**: Started the 'Charan Paduka Abhiyan' to provide free shoes to school kids, showing empathy toward barefoot children facing extreme weather."
          ]
        }
      ],
      conclusion: "Thus, incorporating empathy and compassion transforms the civil service from a cold regulatory system into a warm guardian of welfare, fulfilling the true spirit of Mahatma Gandhi's Talisman."
    }
  },
  {
    id: 2,
    title: "How do ocean currents and water masses differ in their impacts on marine life and coastal environment?",
    paper: "GS1",
    subject: "Geography",
    sectionGroup: "Physical Geography & Geophysical Phenomena",
    section: "Salient Features of World Physical Geography",
    subTopic: "Oceanography",
    wordLimit: 150,
    year: 2019,
    institute: "UPSC Official",
    isPyq: true,
    modelAnswer: {
      introduction: "Ocean currents (horizontal flows) and water masses (vertically stratified parcels of water with distinct salinity/temperature) form the global thermal engine, differently shaping marine biodiversity and coastal climates.",
      bodyPoints: [
        {
          heading: "Impact of Ocean Currents",
          bullets: [
            "**Climate**: Warm currents (e.g. Gulf Stream) keep European ports ice-free; cold currents (e.g. Humboldt) cause coastal desiccation, creating deserts like the Atacama.",
            "**Marine Life**: Convergence of warm and cold currents (e.g., Kuroshio and Oyashio near Japan) creates massive fishing zones due to phytoplankton blooms."
          ]
        },
        {
          heading: "Impact of Water Masses",
          bullets: [
            "**Nutrient Circulation**: Deep water masses (like Antarctic Bottom Water) drive the global conveyor belt, bringing nutrient-rich bottom waters to surface zones via upwelling.",
            "**Marine Zonation**: Creates distinct ecological niches vertically, separating pelagic life based on temperature and dissolved oxygen layers."
          ]
        }
      ],
      conclusion: "Therefore, understanding these physical systems is essential for marine conservation and adapting coastal infrastructure to climate-induced variations."
    }
  },
  {
    id: 5,
    title: "Distinguish between religiosity/religiousness and communalism giving one example of how the former can lead to the latter and how it can be prevented.",
    paper: "GS1",
    subject: "Society",
    sectionGroup: "Social Dynamics & Ideologies",
    section: "National Integration & Challenges",
    subTopic: "Communalism",
    wordLimit: 150,
    year: 2017,
    institute: "UPSC Official",
    isPyq: true,
    modelAnswer: {
      introduction: "Religiosity refers to personal faith and devotion to religious values, whereas communalism is a political ideology that uses religious identity to mobilize groups against other communities.",
      bodyPoints: [
        {
          heading: "How Religiosity Can Slide Into Communalism",
          bullets: [
            "Occurs when personal devotion turns into dogmatic superiority, fueled by identity politics and social insecurity.",
            "*Example*: Peaceful traditional festivals being hijacked by political groups to organize polarized marches, asserting dominance and triggering local riots."
          ]
        },
        {
          heading: "Prevention Strategies",
          bullets: [
            "Encouraging inter-faith dialogue, utilizing shared cultural spaces (like Ajmer Dargah or Sufi-Bhakti festivals).",
            "Promoting secular constitutional values in schools and active community policing to curb hate speech."
          ]
        }
      ],
      conclusion: "Thus, keeping religiosity strictly personal and preventing its exploitation for political gains is critical to maintaining social harmony in a pluralistic India."
    }
  }
];

export const mockValueAdditionData: ValueAdditionItem[] = [
  {
    id: "df-1",
    category: "data_facts",
    paper: "GS3",
    subject: "Disaster Management",
    sectionGroup: "Frameworks & Preparedness",
    title: "Climate Risk Index 2025",
    metric: "Rank 6th / 80k Deaths",
    context: "India is ranked the 6th most affected country due to extreme weather events (1993-2022). It suffered 80,000 fatalities (10% of global total) and accounts for 4.3% of global economic losses (USD 180 billion).",
    source: "Sunya IAS / Germanwatch Climate Risk Index",
    rawContent: "<!-- Theme: Climate Risk Index 2025 --><br><b><u>Climate Risk Index 2025</u></b><br>- India ranked **6th most affected country** (1993-2022)<br>- **80,000 fatalities** (10% of global) due to extreme weather events<br>- **4.3% of global economic losses** (USD 180 billion)."
  },
  {
    id: "df-2",
    category: "data_facts",
    paper: "GS3",
    subject: "Disaster Management",
    sectionGroup: "Frameworks & Preparedness",
    title: "Drought and Land Vulnerability in India",
    metric: "40% Land Area Prone",
    context: "Around 40% of India's landmass is prone to droughts, affecting 40% of the population. 70% of cultivable areas face soil moisture deficiency. Drought frequency increased by 60% in the last 25 years.",
    source: "Sunya IAS / NDMA Data",
    rawContent: "<!-- Theme: Disaster Stats --><br><b><u>Disaster Stats</u></b><br>- **Internal displacements due to natural disasters:** 5.4 million displacements in 2024 (IDMC report)<br>• <b><u>Droughts</u></b><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- **Impact:** 40% land area and 70 % of cultivable area prone to droughts<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- 60% increase in droughts in last 25 years<br>• <b><u>Earthquakes</u></b><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- **Vulnerability:** 60% of landmass is prone to Earthquake(80% of population)"
  },
  {
    id: "df-3",
    category: "data_facts",
    paper: "GS3",
    subject: "Economy",
    sectionGroup: "Agriculture",
    title: "Agrarian Structural Dualism",
    metric: "45% labor vs 18% GVA",
    context: "Despite employing nearly 45% of the Indian workforce, agriculture contributes only about 18% to the Gross Value Added (GVA), highlighting severe structural dualism and lower per-capita farm income.",
    source: "Economic Survey 2025-26",
    rawContent: "<!-- Theme: Agrarian Structural Dualism --><br><b><u>Agrarian Structural Dualism</u></b><br>- **Employment:** Employing nearly **45% of the workforce**<br>- **Economic Output:** Contributes only **18% to GVA**<br>- **Incomes:** High dualism and lower farm income compared to services."
  },
  {
    id: "ic-1",
    category: "intro_conclusion",
    paper: "GS1",
    subject: "History",
    sectionGroup: "Art and Culture",
    microtopic: "Indian Culture - Salient Aspects",
    subtopic: "Bhakti and Sufi movement",
    title: "Medieval Bhakti and Sufi Literature",
    introduction: "Bhakti and Sufi literature democratized religion by prioritizing love and personal devotion over rituals. Through regional languages and metaphors, saints unified society beyond caste and creed.",
    conclusion: "Their teachings remain relevant in today’s fractured socio-religious landscape, serving as a template for communal harmony and inclusive nationalism.",
    source: "Readymade Intro/Conclusion - GS-1",
    rawContent: "###### Card 1: Medieval Bhakti and Sufi Literature\n*   **Introduction:**\n    *   Bhakti and Sufi literature democratized religion by prioritizing love and personal devotion over rituals. Through regional languages and metaphors, saints unified society beyond caste and creed.\n*   **Conclusion:**\n    *   Their teachings remain relevant in today’s fractured socio-religious landscape, guiding inclusive nationalism."
  },
  {
    id: "ic-2",
    category: "intro_conclusion",
    paper: "GS2",
    subject: "Polity",
    sectionGroup: "Governance & Administration",
    microtopic: "Constitutional Bodies",
    subtopic: "Model Code of Conduct",
    title: "Election Commission & Electoral Integrity",
    introduction: "The Election Commission of India (ECI), acting under Article 324, operates as the institutional custodian of electoral integrity, balancing partisan disputes with democratic rules through tools like the Model Code of Conduct.",
    conclusion: "Strengthening ECI requires protecting its independence from executive encroachment and updating electoral laws to handle digital propaganda and opaque campaign funding.",
    source: "Readymade Intro/Conclusion - GS-2",
    rawContent: "###### Card 1: Election Commission & Electoral Integrity\n*   **Introduction:**\n    *   The Election Commission of India (ECI) acts under **Article 324** to manage electoral processes. Its evolution of the **Model Code of Conduct (MCC)** stands as a key check on state resources.\n*   **Conclusion:**\n    *   A level playing field requires ECI independence, social media codes, and strong financing checks."
  },
  {
    id: "qt-1",
    category: "quotes",
    paper: "Essay",
    subject: "General",
    title: "Sufi-Bhakti Synthesis Quote",
    quoteText: "Kabir's words cut sharper than a sword, yet stitch together a divided world.",
    author: "Rabindranath Tagore",
    usageGuide: "Highly recommended for essays on communal harmony, unity in diversity, or spiritual history."
  },
  {
    id: "qt-2",
    category: "quotes",
    paper: "GS4",
    subject: "Ethics",
    title: "Forgiveness & Strength",
    quoteText: "The weak can never forgive. Forgiveness is the attribute of the strong.",
    author: "Mahatma Gandhi",
    usageGuide: "Use in GS4 Section A questions regarding emotional intelligence, conflict resolution, or moral strength."
  },
  {
    id: "mn-1",
    category: "mnemonics",
    paper: "GS1",
    subject: "Society",
    sectionGroup: "Foundations & Diversity",
    microtopic: "Diversity of India",
    subtopic: "Diversity and pluralism",
    title: "Vedic Society Continuities in Modern India",
    mnemonicKeyword: "VEDIC ROOTS",
    mnemonicExpansion: [
      { letter: "V", meaning: "Veneration of Nature", detail: "Worshipping Ganga, Chhath Puja sun worship." },
      { letter: "E", meaning: "Emphasis on Learning", detail: "Reverence for teachers, Guru Purnima traditions." },
      { letter: "D", meaning: "Dharma (Righteousness)", detail: "Moral and ethical duties guiding daily social action." },
      { letter: "I", meaning: "Importance of Rituals", detail: "Fire sacrifices (yagnas) in temples like Tirupati." },
      { letter: "C", meaning: "Caste System (Varna)", detail: "Persistent caste indicators in rural social marriages." },
      { letter: "R", meaning: "Respect for Elders", detail: "Guru-Shishya respect embedded in family structures." },
      { letter: "O", meaning: "Oral Traditions", detail: "Continuous oral chanting of Rigveda in Varanasi." },
      { letter: "O", meaning: "Observance of offerings", detail: "Offering flowers/fruits in Pujas rather than animals." },
      { letter: "T", meaning: "Tradition of Yoga/Meditation", detail: "Modern wellness roots in ancient Upanishad practices." },
      { letter: "S", meaning: "Sanskrit as sacred", detail: "Sanskrit mantras used in marriage and death rites." }
    ],
    context: "Mnemonic to remember which features of Vedic Society continue to thrive in India today.",
    source: "Neelesh Sir Mnemonic Series",
    rawContent: "###### Mnemonic 3: Continuities of Vedic Society"
  },
  {
    id: "fw-1",
    category: "frameworks",
    paper: "General",
    subject: "General",
    title: "PESTLE Framework",
    frameworkBoxes: [
      { label: "P - Political", description: "Government stability, administrative policy changes, political will, and federal cooperation." },
      { label: "E - Economic", description: "GDP growth, inflation, agrarian income, resource distribution, and fiscal space." },
      { label: "S - Social", description: "Demographic dividend, cultural traditions, social inequalities, gender ratios, and local participation." },
      { label: "T - Technological", description: "Digital access, automation, AI tools, cybersecurity, and tech infrastructure in rural areas." },
      { label: "L - Legal", description: "Constitutional safety, statutory protection, judicial delays, and enforcement of contracts." },
      { label: "E - Environmental", description: "Climate change vulnerability, resource depletion, biodiversity loss, and sustainable practices." }
    ],
    frameworkGuide: "Best suited to analyze the socio-economic and structural impacts of new policies, technologies, or bills (e.g. UCC, Agri-Reforms, AI deployment)."
  },
  {
    id: "et-diag1",
    category: "ethics",
    paper: "GS4",
    subject: "Ethics",
    title: "Ethics vs Morality Venn Diagram",
    ethicsType: "diagram",
    ethicsData: {
      diagramType: "Venn Diagram",
      diagramDescription: "[ Circle A: Morality (Personal Values) ] ── Overlaps ── [ Circle B: Ethics (Societal Codes) ]\nIntersection: 'Ethical Consistency' (where personal integrity fits institutional standards).",
      values: "Ideal for questions distinguishing legal codes, morals, and administrative ethics."
    }
  },
  {
    id: "et-dim1",
    category: "ethics",
    paper: "GS4",
    subject: "Ethics",
    title: "6 Dimensions of Ethics",
    ethicsType: "dimension",
    ethicsData: {
      dimensionsList: [
        "1. Utilitarian Dimension: Achieving the greatest good for the maximum population.",
        "2. Deontological (Duty) Dimension: Strict adherence to constitutional and legal duty regardless of popular will.",
        "3. Virtue Ethics: Internalizing integrity, empathy, and honesty within the administrator's character.",
        "4. Rights-Based Dimension: Protecting basic human rights and dignity of marginalized communities.",
        "5. Justice & Fairness: Equal treatment and affirmative action to correct historical disadvantages.",
        "6. Common Good Dimension: Fostering public trust and building community resilience."
      ]
    }
  },
  {
    id: "et-comp1",
    category: "ethics",
    paper: "GS4",
    subject: "Ethics",
    title: "Attitude vs Aptitude",
    ethicsType: "comparison",
    ethicsData: {
      comparisonPoints: [
        { criteria: "Definition", termA: "Attitude: Mental predisposition or emotional orientation toward a person or concept.", termB: "Aptitude: Natural capability or acquired potential to learn and perform specific skills." },
        { criteria: "Origin", termA: "Largely environmental; shaped by family, education, and socialization.", termB: "Largely innate; refined by training, experience, and cognitive intelligence." },
        { criteria: "Role in Civil Service", termA: "Guides ethical behavior, empathy, public service motivation, and compassion.", termB: "Guides technical competency, decision-making efficiency, and crisis handling." },
        { criteria: "Flexibility", termA: "Can be changed through persuasive communication and cognitive restructuring.", termB: "Stable potential; requires systematic skill training to improve performance." }
      ]
    }
  },
  {
    id: "et-innov1",
    category: "ethics",
    paper: "GS4",
    subject: "Ethics",
    title: "Ashok Khemka (IAS)",
    ethicsType: "innovation",
    ethicsData: {
      officerName: "Ashok Khemka (IAS)",
      initiative: "Anti-corruption Land Transaction Cancellations & IT Integrations",
      impact: "Cancelled a major ₹150-crore questionable land mutation in Gurgaon in 2012. Suffered 57 transfers over a 30-year career, yet remained committed to ethical administration.",
      values: "Absolute Integrity, Moral Courage, Professionalism, Resilience"
    }
  },
  {
    id: "et-innov2",
    category: "ethics",
    paper: "GS4",
    subject: "Ethics",
    title: "Armstrong Pame (IAS)",
    ethicsType: "innovation",
    ethicsData: {
      officerName: "Armstrong Pame (IAS)",
      initiative: "The 'People's Road' Construction in Manipur",
      impact: "Crowdfunded ₹40 lakh online to build a 100km road in Manipur in 7 months without government funds, connecting remote villages to healthcare and trade.",
      values: "Empathy, Compassion, Public Service Motivation, Community Ownership"
    }
  },
  {
    id: "et-quote1",
    category: "ethics",
    paper: "GS4",
    subject: "Ethics",
    title: "Socrates' Inquiry Quote",
    ethicsType: "pyq_quote",
    ethicsData: {
      keywordDefinition: "\"An unexamined life is not worth living\" - Socrates [UPSC PYQ]",
      keywordExample: "Admin Relevance: Administrators must constantly reflect on their decisions, examining whether their administrative actions align with the constitutional values of justice, equity, and empathy."
    }
  },
  {
    id: "et-key1",
    category: "ethics",
    paper: "GS4",
    subject: "Ethics",
    title: "Moral Compass",
    ethicsType: "keyword",
    ethicsData: {
      keywordDefinition: "Inner guide or set of values that determines right from wrong in decision-making.",
      keywordExample: "Example: IAS officer refusing political pressure to allocate tribal forest lands during local conflicts, adhering to their constitutional oath."
    }
  },
  {
    id: "et-key2",
    category: "ethics",
    paper: "GS4",
    subject: "Ethics",
    title: "Ethical Dissonance",
    ethicsType: "keyword",
    ethicsData: {
      keywordDefinition: "The mental conflict arising when an individual's personal values mismatch their administrative actions.",
      keywordExample: "Example: Doctors during a health crisis facing a conflict between strict triage rules (greatest good) and senior directives favoring specific individuals."
    }
  }
];
