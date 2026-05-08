import { Bell, Share2, Upload, MoreVertical, ChevronLeft } from 'lucide-react';

interface GlanceViewProps {
  onBack?: () => void;
  onOpenEditor?: () => void;
}

export function GlanceView({ onBack, onOpenEditor }: GlanceViewProps) {
  return (
    <div className="flex-1 bg-background overflow-y-auto flex flex-col">
      {/* Sticky Header */}
      <div className="bg-white border-b border-border px-6 py-4 shrink-0 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2>Article 14 — Equality Before Law</h2>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Upload className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content - MASSIVE DOCUMENT FOR SCROLL TESTING */}
      <div className="flex-1 px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <article className="prose prose-slate max-w-none">
            {/* Main Title */}
            <div className="mb-8">
              <div className="flex items-start justify-between mb-6">
                <h1 className="mb-0">Article 14 — Equality Before Law</h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800 shrink-0 ml-4">
                  Key Point
                </span>
              </div>
              <p className="text-lg text-gray-600">
                A comprehensive study guide on Article 14 of the Indian Constitution, covering the fundamental
                right to equality, its interpretation, exceptions, and landmark judicial pronouncements.
              </p>
            </div>

            {/* Section 1: Introduction */}
            <section className="mb-10">
              <h2 className="mb-4">Introduction to Equality Before Law</h2>
              <ul className="space-y-4 text-gray-700">
                <li>
                  <p>
                    Article 14 of the Indian Constitution guarantees the{' '}
                    <span className="bg-yellow-200">Right to Equality</span>. It states: "The State shall not deny to
                    any person equality before the law or the equal protection of the laws within the territory of
                    India." This foundational principle ensures that no individual or group receives preferential
                    treatment under the law, establishing a bedrock for justice and fairness in Indian democracy.
                  </p>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                      Key Point
                    </span>
                  </div>
                </li>
                <li>
                  <p>
                    The article embodies two fundamental concepts — <span className="bg-yellow-200">Equality before Law</span>{' '}
                    (derived from British common law, a negative concept meaning no person is above the law) and{' '}
                    <span className="bg-yellow-200">Equal Protection of Laws</span> (borrowed from the American Constitution,
                    a positive concept requiring the state to provide equal treatment in similar circumstances). These twin
                    pillars work together to create a comprehensive framework of equality in Indian jurisprudence.
                  </p>
                </li>
                <li>
                  <p>
                    Article 14 applies to all persons, whether citizens or non-citizens, within the territory of India.
                    This universality is a hallmark of Indian constitutional values, extending basic protections even to
                    foreign nationals and stateless persons who find themselves under Indian jurisdiction.
                  </p>
                </li>
              </ul>
            </section>

            {/* Section 2: Rule of Law */}
            <section className="mb-10">
              <h2 className="mb-4">The Rule of Law and Dicey's Principles</h2>
              <ul className="space-y-4 text-gray-700">
                <li>
                  <p>
                    The concept of "equality before law" is synonymous with the British doctrine of{' '}
                    <span className="bg-yellow-200">Rule of Law</span> as propounded by A.V. Dicey. According to Dicey,
                    the rule of law has three essential components: supremacy of law (no person is punishable except for
                    a distinct breach of law), equality before the law (no person is above the law), and predominance of
                    legal spirit (constitutional law is the result of judicial decisions determining rights of individuals).
                  </p>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                      Key Point
                    </span>
                  </div>
                </li>
                <li>
                  <p>
                    In India, the rule of law operates with some modifications. While the British system has absolute
                    equality with no written constitution, India's rule of law functions within the framework of a
                    written Constitution that itself provides for certain exceptions and special provisions. These
                    modifications are necessary to address India's unique social, cultural, and historical context,
                    including affirmative action for historically disadvantaged groups.
                  </p>
                </li>
                <li>
                  <p>
                    The Supreme Court has held that the rule of law is a basic feature of the Constitution and cannot
                    be amended even by Parliament. This was established in various landmark judgments, making it an
                    unchangeable cornerstone of Indian constitutional democracy that protects citizens from arbitrary
                    state action.
                  </p>
                </li>
              </ul>
            </section>

            {/* Section 3: Exceptions */}
            <section className="mb-10">
              <div className="flex items-start justify-between mb-4">
                <h2 className="mb-0">Exceptions to Article 14</h2>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-red-100 text-red-800 shrink-0">
                  Important
                </span>
              </div>
              <p className="mb-4 text-gray-700">
                While Article 14 is a fundamental right, it is not absolute. The Constitution and various judicial
                interpretations have carved out certain exceptions:
              </p>
              <ul className="space-y-4 text-gray-700">
                <li>
                  <p>
                    <strong>Presidential and Gubernatorial Immunity:</strong> The President and Governors of States
                    enjoy immunity from criminal proceedings during their term of office. They cannot be arrested or
                    imprisoned, and no criminal proceedings can be instituted or continued against them in any court
                    during their term. However, this immunity does not extend to civil proceedings in certain cases,
                    and it only suspends proceedings rather than extinguishing liability entirely.
                  </p>
                </li>
                <li>
                  <p>
                    <strong>Parliamentary Privileges:</strong> Members of Parliament and State Legislatures enjoy
                    certain privileges and immunities. They have <span className="bg-yellow-200">freedom of speech</span>{' '}
                    in the legislature and cannot be liable to any proceedings in any court in respect of anything said
                    or any vote given in Parliament or State Legislature. This privilege is essential for the
                    functioning of a democratic legislature, allowing representatives to speak freely without fear of
                    legal consequences.
                  </p>
                </li>
                <li>
                  <p>
                    <strong>Diplomatic Immunity:</strong> Foreign diplomats and ambassadors are immune from the
                    jurisdiction of Indian courts in both civil and criminal matters. This immunity is based on
                    international law and the Vienna Convention on Diplomatic Relations, ensuring that diplomatic
                    personnel can perform their duties without interference from host country legal processes.
                  </p>
                </li>
                <li>
                  <p>
                    <strong>International Organizations:</strong> The United Nations and its specialized agencies,
                    along with their officials, enjoy certain immunities and privileges under international agreements.
                    These immunities facilitate international cooperation and ensure these organizations can operate
                    independently across national boundaries.
                  </p>
                </li>
              </ul>
            </section>

            {/* Section 4: Reasonable Classification */}
            <section className="mb-10">
              <h2 className="mb-4">Doctrine of Reasonable Classification</h2>
              <ul className="space-y-4 text-gray-700">
                <li>
                  <p>
                    Article 14 does not prohibit all classifications but only{' '}
                    <span className="bg-red-200">unreasonable or arbitrary</span> classifications. The principle of
                    reasonable classification allows the state to treat different groups differently if there is a
                    rational basis for doing so. This doctrine reconciles equality with the practical needs of
                    governance and social welfare.
                  </p>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                      Key Point
                    </span>
                  </div>
                </li>
                <li>
                  <p>
                    For a classification to be constitutionally valid, it must satisfy two conditions: (1) The
                    classification must be founded on an <span className="bg-yellow-200">intelligible differentia</span>{' '}
                    that distinguishes persons or things grouped together from those left out, and (2) The differentia
                    must have a <span className="bg-yellow-200">rational relation</span> to the object sought to be
                    achieved by the statute. Both conditions must be satisfied simultaneously.
                  </p>
                </li>
                <li>
                  <p>
                    The classification may be based on geographical, or according to objects or occupations, and the
                    like. The Court examines whether the classification is reasonable and not arbitrary, whether it is
                    based on some real and substantial distinction bearing a just and reasonable relation to the object
                    sought to be achieved. Examples include different tax rates for different income brackets,
                    different retirement ages for different services, and different educational qualifications for
                    different posts.
                  </p>
                </li>
              </ul>
            </section>

            {/* Section 5: Landmark Cases */}
            <section className="mb-10">
              <div className="flex items-start justify-between mb-4">
                <h2 className="mb-0">Landmark Judicial Pronouncements</h2>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-green-100 text-green-800 shrink-0">
                  Important Cases
                </span>
              </div>
              <ul className="space-y-4 text-gray-700">
                <li>
                  <p>
                    <strong>State of West Bengal v. Anwar Ali Sarkar (1952):</strong> This was one of the earliest
                    cases where the Supreme Court laid down the test for reasonable classification. The Court held that
                    Article 14 forbids <span className="bg-red-200">class legislation</span> but permits reasonable
                    classification for the purposes of legislation. The judgment established that classification must
                    not be arbitrary, artificial or evasive, but must be based on some real and substantial distinction
                    bearing a reasonable and just relation to the object sought to be achieved.
                  </p>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      Important Case
                    </span>
                  </div>
                </li>
                <li>
                  <p>
                    <strong>E.P. Royappa v. State of Tamil Nadu (1974):</strong> This landmark case introduced the
                    concept of <span className="bg-yellow-200">equality as a basic feature</span> of the Constitution.
                    Justice Bhagwati observed that equality is a dynamic concept with many aspects and dimensions and
                    it cannot be cribbed, cabined and confined within traditional and doctrinaire limits. From a
                    positivistic point of view, equality is antithetic to arbitrariness. In fact, equality and
                    arbitrariness are sworn enemies; one belongs to the rule of law in a republic while the other, to
                    the whim and caprice of an absolute monarch.
                  </p>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      Important Case
                    </span>
                  </div>
                </li>
                <li>
                  <p>
                    <strong>Maneka Gandhi v. Union of India (1978):</strong> Though primarily dealing with Article 21,
                    this case expanded the scope of Article 14 by holding that any law that deprives a person of
                    personal liberty must not only be just, fair, and reasonable but also must not be arbitrary. The
                    Court held that Articles 14, 19, and 21 form a "golden triangle" and they cannot be read in
                    isolation. This decision marked a watershed moment in Indian constitutional law, establishing that
                    procedure established by law must also be fair and reasonable.
                  </p>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      Important Case
                    </span>
                  </div>
                </li>
                <li>
                  <p>
                    <strong>Indra Sawhney v. Union of India (1992):</strong> Also known as the Mandal Commission case,
                    this judgment dealt with reservations for Other Backward Classes (OBCs). The Supreme Court upheld
                    27% reservation for OBCs in government jobs while laying down the principle that total reservations
                    should not exceed <span className="bg-yellow-200">50%</span> except in extraordinary situations.
                    The Court also introduced the concept of the creamy layer, holding that the affluent among backward
                    classes should be excluded from reservation benefits to ensure benefits reach those who genuinely
                    need them.
                  </p>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      Important Case
                    </span>
                  </div>
                </li>
              </ul>
            </section>

            {/* Section 6: Relationship with Other Articles */}
            <section className="mb-10">
              <h2 className="mb-4">Relationship with Other Fundamental Rights</h2>
              <ul className="space-y-4 text-gray-700">
                <li>
                  <p>
                    Article 14 is the generic provision on equality, while Articles 15, 16, 17, and 18 are specific
                    applications of the general rule enshrined in Article 14. These articles prohibit discrimination
                    on specific grounds and in specific contexts, creating a comprehensive framework for equality.
                  </p>
                </li>
                <li>
                  <p>
                    <strong>Article 15</strong> prohibits discrimination on grounds of religion, race, caste, sex, or
                    place of birth in matters relating to access to shops, public restaurants, hotels, and places of
                    public entertainment, or the use of wells, tanks, bathing ghats, roads, and places of public resort
                    maintained wholly or partly out of State funds or dedicated to the use of the general public. However,
                    it permits the State to make special provisions for women and children, and for the advancement of
                    socially and educationally backward classes, Scheduled Castes, and Scheduled Tribes.
                  </p>
                </li>
                <li>
                  <p>
                    <strong>Article 16</strong> guarantees equality of opportunity in matters of public employment and
                    prohibits discrimination on grounds of religion, race, caste, sex, descent, place of birth, or
                    residence. It also permits reservations for backward classes, SCs, STs, and provides that residence
                    requirements may be prescribed for certain posts. The article also contains provisions for
                    reservation in promotion for SCs and STs if they are not adequately represented in the services.
                  </p>
                </li>
                <li>
                  <p>
                    <strong>Article 17</strong> abolishes <span className="bg-red-200">untouchability</span> and
                    forbids its practice in any form. The enforcement of any disability arising out of untouchability
                    is made an offense punishable in accordance with law. This provision represents a conscious effort
                    to eliminate one of India's most pernicious social evils and has been implemented through
                    legislation like the Protection of Civil Rights Act, 1955.
                  </p>
                </li>
              </ul>
            </section>

            {/* Section 7: Modern Interpretations */}
            <section className="mb-10">
              <h2 className="mb-4">Contemporary Application and Evolving Jurisprudence</h2>
              <ul className="space-y-4 text-gray-700">
                <li>
                  <p>
                    In recent years, the Supreme Court has expanded the scope of Article 14 to include the right to
                    equality in administrative action. Any administrative action that is arbitrary, unreasonable, or
                    discriminatory can be struck down as violative of Article 14. This extension has made Article 14
                    a powerful tool for checking administrative excess and ensuring fairness in government action.
                  </p>
                </li>
                <li>
                  <p>
                    The principle of <span className="bg-yellow-200">substantive equality</span> has gained prominence,
                    moving beyond formal equality. Courts now recognize that treating unequals equally can perpetuate
                    inequality, and thus affirmative action and special measures are not only permissible but sometimes
                    constitutionally mandated to achieve real equality. This shift reflects a more nuanced understanding
                    of equality that accounts for historical disadvantages and structural inequalities.
                  </p>
                </li>
                <li>
                  <p>
                    Technology and digitalization have raised new questions about equality. Issues such as algorithmic
                    bias, digital divide, and equal access to online services are being examined through the lens of
                    Article 14. The fundamental right to equality is being interpreted to ensure that technological
                    advancement does not create new forms of discrimination or exacerbate existing inequalities.
                  </p>
                </li>
              </ul>
            </section>

            {/* Section 8: Critical Analysis */}
            <section className="mb-10">
              <h2 className="mb-4">Critical Analysis and Challenges</h2>
              <ul className="space-y-4 text-gray-700">
                <li>
                  <p>
                    While Article 14 provides a strong foundation for equality, its implementation faces several
                    challenges. The concept of "reasonable classification" is inherently subjective and can be
                    manipulated to justify discriminatory practices. Courts must constantly balance the need for
                    classification with the imperative of equality, a task that requires careful judicial scrutiny.
                  </p>
                </li>
                <li>
                  <p>
                    The tension between formal equality and substantive equality continues to generate debate.
                    Critics argue that excessive focus on affirmative action might reverse discriminate against
                    certain groups, while proponents contend that without such measures, historical inequalities
                    cannot be remedied. This debate reflects broader societal disagreements about the meaning and
                    goals of equality in a diverse democracy.
                  </p>
                </li>
                <li>
                  <p>
                    Implementation gaps remain significant. Despite constitutional guarantees, discrimination persists
                    in various forms across Indian society. Economic inequality, caste-based discrimination, gender
                    disparities, and regional imbalances continue to challenge the promise of Article 14. Bridging
                    the gap between constitutional ideals and ground realities requires sustained effort from all
                    branches of government and civil society.
                  </p>
                </li>
              </ul>
            </section>

            {/* End Marker */}
            <div className="text-center text-gray-400 text-sm py-8 border-t border-border mt-16">
              — End of Glance —
            </div>
          </article>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-white border-t border-border px-6 py-3 shrink-0">
        <div className="flex items-center justify-center">
          <button
            onClick={onOpenEditor}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            Open in Editor
          </button>
        </div>
      </div>
    </div>
  );
}
