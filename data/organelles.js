"use strict";

/*
 * Central biology + city-analogy data for every structure in the City.
 * JSON-compatible (plain objects, arrays and strings) and loaded with a
 * normal <script> so the site also works when opened directly from disk
 * (browsers block fetch() of local .json files on file://).
 *
 * Cell City depicts a generalised animal (eukaryotic) cell.
 */
window.CellCity = window.CellCity || {};
window.CellCity.data = window.CellCity.data || {};

window.CellCity.data.organelles = {
  order: [
    "nucleus",
    "mitochondria",
    "ribosomes",
    "rough-er",
    "smooth-er",
    "golgi",
    "lysosomes",
    "vesicles",
    "membrane",
    "cytoplasm",
    "cytoskeleton",
  ],

  items: {
    nucleus: {
      name: "Nucleus",
      mapName: "Nucleus",
      cityRole: "City Hall",
      shortRole: "City Hall",
      kind: "organelle",
      accent: "biology",
      sprite: "nucleus",
      aliases: ["dna", "chromatin", "nucleolus", "administration", "genes"],
      summary:
        "The nucleus stores most of the cell's DNA and controls which genes are switched on, directing the cell's activities.",
      analogy:
        "Like a city hall, it keeps the master plans (DNA) safe and sends out instructions (mRNA) rather than letting the plans leave the building.",
      details: [
        "The nucleus is enclosed by a double membrane called the nuclear envelope. Nuclear pores perforate it and regulate which molecules pass: finished mRNA leaves, while proteins that regulate genes enter.",
        "Inside, DNA is wound around histone proteins and packaged as chromatin; it condenses into visible chromosomes when the cell divides. A dense region called the nucleolus assembles the subunits of ribosomes.",
      ],
      functions: [
        "Stores the cell's genetic material (DNA).",
        "Carries out transcription, copying genes into RNA.",
        "Regulates gene expression, deciding which proteins are made and when.",
        "Assembles ribosomal subunits in the nucleolus.",
        "Copies its DNA (replication) before the cell divides.",
      ],
      facts: [
        "The nuclear envelope is continuous with the endoplasmic reticulum.",
        "Mature human red blood cells have no nucleus, while skeletal muscle fibres contain many.",
      ],
      relationships: [
        { id: "ribosomes", text: "Receives mRNA from the nucleus and uses it to build proteins." },
        { id: "rough-er", text: "The outer nuclear membrane is continuous with the rough ER." },
        { id: "mitochondria", text: "Depends on mitochondrial ATP for transcription, replication and transport through pores." },
      ],
    },

    mitochondria: {
      name: "Mitochondria",
      mapName: "Mitochondria",
      cityRole: "Power Plants",
      shortRole: "Power Plants",
      kind: "organelle",
      accent: "energy",
      sprite: "mitochondria",
      aliases: ["atp", "energy", "respiration", "powerhouse", "cristae"],
      summary:
        "Mitochondria are double-membrane organelles that make most of a cell's ATP through aerobic respiration.",
      analogy:
        "Like power plants, they take in fuel (products of food breakdown, plus oxygen) and release usable energy (ATP) that the whole city runs on.",
      details: [
        "A mitochondrion has a smooth outer membrane and a heavily folded inner membrane. The folds, called cristae, increase the surface area that holds the electron transport chain and ATP synthase. The inner space is the matrix.",
        "The citric acid cycle runs in the matrix, while oxidative phosphorylation uses the inner membrane to produce most of the ATP from each glucose molecule. Glycolysis, the first stage of glucose breakdown, happens earlier in the cytoplasm.",
      ],
      functions: [
        "Produces most of the cell's ATP by aerobic respiration.",
        "Runs the citric acid cycle and oxidative phosphorylation.",
        "Helps store and regulate calcium ions.",
        "Takes part in programmed cell death (apoptosis).",
      ],
      facts: [
        "Mitochondria carry their own small circular DNA and their own ribosomes.",
        "Cells with high energy demands, such as heart muscle cells, contain very large numbers of them.",
        "In humans, mitochondrial DNA is inherited almost entirely from the mother.",
      ],
      relationships: [
        { id: "cytoplasm", text: "Receives pyruvate from glycolysis in the cytoplasm as fuel." },
        { id: "ribosomes", text: "Supplies the ATP that powers protein synthesis." },
        { id: "cytoskeleton", text: "Is moved to where energy is needed along cytoskeleton tracks." },
      ],
    },

    ribosomes: {
      name: "Ribosomes",
      mapName: "Ribosomes",
      cityRole: "Protein Factories",
      shortRole: "Protein Factories",
      kind: "organelle",
      accent: "biology",
      sprite: "ribosome-yard",
      aliases: ["translation", "protein synthesis", "rrna", "mrna", "trna"],
      summary:
        "Ribosomes read messenger RNA and join amino acids into protein chains in a process called translation.",
      analogy:
        "Like a cluster of small factories, each ribosome follows a work order (mRNA) and assembles a product (a protein) one part at a time.",
      details: [
        "A ribosome is built from ribosomal RNA (rRNA) and proteins, arranged as a large and a small subunit. It is not surrounded by a membrane, and it is found in every type of cell.",
        "Free ribosomes float in the cytosol and make proteins used inside the cell. Ribosomes attached to the rough ER make proteins that will be secreted, placed in the cell membrane or delivered to lysosomes. Several ribosomes can read one mRNA at the same time.",
      ],
      functions: [
        "Translate mRNA codons into a chain of amino acids.",
        "Catalyse peptide bond formation between amino acids (a job done by the rRNA).",
        "Make proteins for use inside the cell (free ribosomes) or for export and membranes (bound ribosomes).",
      ],
      facts: [
        "Ribosomal subunits are assembled in the nucleolus and exported to the cytoplasm.",
        "Transfer RNAs (tRNAs) bring the matching amino acid for each codon.",
        "Bacterial ribosomes are smaller than those of eukaryotes, which is why some antibiotics target them.",
      ],
      relationships: [
        { id: "nucleus", text: "Gets its mRNA work orders from the nucleus." },
        { id: "rough-er", text: "Bound ribosomes studding the rough ER make proteins for the secretory pathway." },
        { id: "mitochondria", text: "Relies on ATP and GTP for each step of translation." },
      ],
    },

    "rough-er": {
      name: "Rough Endoplasmic Reticulum",
      mapName: "Rough ER",
      cityRole: "Protein Manufacturing Network",
      shortRole: "Manufacturing Network",
      kind: "organelle",
      accent: "biology",
      sprite: "rough-er",
      aliases: ["rer", "er", "endoplasmic reticulum", "cisternae", "secretion"],
      summary:
        "The rough ER is a network of flattened, ribosome-studded sacs where proteins for secretion, membranes and lysosomes are made and folded.",
      analogy:
        "Like a manufacturing district with an inspection line, it builds products, checks their shape and sends the good ones on for shipping.",
      details: [
        "The rough ER is a continuous system of flattened sacs (cisternae) joined to the nuclear envelope. Ribosomes on its outer surface push the growing protein chain into the ER interior as it is made.",
        "Inside, proteins are folded with the help of chaperone proteins, receive their first sugar groups (glycosylation) and are quality-checked. Correctly folded proteins are packed into transport vesicles that bud off towards the Golgi apparatus.",
      ],
      functions: [
        "Makes proteins destined for secretion, the cell membrane or lysosomes.",
        "Folds proteins and begins adding sugar groups to them.",
        "Checks protein quality and removes misfolded proteins.",
        "Packages finished proteins into vesicles bound for the Golgi.",
      ],
      facts: [
        "Cells that secrete a lot of protein, such as antibody-producing plasma cells and pancreatic enzyme-producing cells, have extensive rough ER.",
        "It looks 'rough' under the electron microscope because of the attached ribosomes.",
      ],
      relationships: [
        { id: "ribosomes", text: "Its surface is covered with ribosomes that make the proteins." },
        { id: "golgi", text: "Sends newly made proteins to the Golgi in transport vesicles." },
        { id: "nucleus", text: "Its membrane is continuous with the nuclear envelope." },
      ],
    },

    "smooth-er": {
      name: "Smooth Endoplasmic Reticulum",
      mapName: "Smooth ER",
      cityRole: "Chemical Processing Centre",
      shortRole: "Chemical Processing",
      kind: "organelle",
      accent: "biology",
      sprite: "smooth-er",
      aliases: ["ser", "er", "lipids", "detox", "calcium", "steroids"],
      summary:
        "The smooth ER is a tubular membrane network without ribosomes that makes lipids, processes chemicals and stores calcium ions.",
      analogy:
        "Like a chemical-processing plant, it manufactures fats and oils and neutralises hazardous substances.",
      details: [
        "The smooth ER is made of branching tubules that are continuous with the rough ER but lack ribosomes. Its enzymes are embedded in its membrane.",
        "It makes phospholipids and cholesterol for new membranes and the steroid hormones in some cells. In liver cells it helps detoxify drugs and poisons, and in muscle cells a specialised version (the sarcoplasmic reticulum) stores calcium ions for contraction.",
      ],
      functions: [
        "Synthesises lipids, including phospholipids, cholesterol and steroid hormones.",
        "Detoxifies certain drugs and metabolic by-products, especially in the liver.",
        "Stores and releases calcium ions.",
        "Takes part in carbohydrate metabolism in liver cells.",
      ],
      facts: [
        "Cells that make steroid hormones, such as those in the adrenal glands, are rich in smooth ER.",
        "Repeated exposure to some drugs can make liver cells produce more smooth ER.",
      ],
      relationships: [
        { id: "rough-er", text: "Is continuous with the rough ER, forming one connected network." },
        { id: "membrane", text: "Supplies the lipids used to build and repair membranes." },
        { id: "vesicles", text: "Sends lipids onward in vesicles." },
      ],
    },

    golgi: {
      name: "Golgi Apparatus",
      mapName: "Golgi Apparatus",
      cityRole: "Packaging and Distribution Centre",
      shortRole: "Distribution Centre",
      kind: "organelle",
      accent: "mutation",
      sprite: "golgi",
      aliases: ["golgi body", "golgi complex", "packaging", "sorting", "post office"],
      summary:
        "The Golgi apparatus modifies, sorts and packages proteins and lipids from the ER and ships them to their destinations.",
      analogy:
        "Like a distribution centre, it receives raw deliveries, finishes and labels them, and loads them onto delivery vehicles with the right address.",
      details: [
        "The Golgi is a stack of flattened membrane sacs with two faces. The cis face receives vesicles from the ER, and the trans face releases finished vesicles. Molecules are modified step by step as they move through the stack.",
        "Modifications include trimming and extending sugar chains. The Golgi also adds molecular tags that sort proteins into vesicles headed for the cell membrane, for secretion outside the cell, or for lysosomes.",
      ],
      functions: [
        "Modifies proteins and lipids, for example by adding or trimming sugar groups.",
        "Sorts and tags molecules according to their destination.",
        "Packages cargo into vesicles for secretion, the cell membrane or lysosomes.",
        "Helps make the enzyme-containing vesicles that become lysosomes.",
      ],
      facts: [
        "It is named after the Italian scientist Camillo Golgi, who described it in 1898.",
        "Secretory cells, such as those of salivary glands, have prominent Golgi apparatuses.",
      ],
      relationships: [
        { id: "rough-er", text: "Receives newly made proteins from the rough ER." },
        { id: "vesicles", text: "Ships its finished products in transport vesicles." },
        { id: "lysosomes", text: "Delivers the enzymes that lysosomes need." },
      ],
    },

    lysosomes: {
      name: "Lysosomes",
      mapName: "Lysosomes",
      cityRole: "Recycling and Waste Processing",
      shortRole: "Recycling Plant",
      kind: "organelle",
      accent: "danger",
      sprite: "lysosome",
      aliases: ["digestion", "waste", "enzymes", "autophagy", "hydrolase", "recycling"],
      summary:
        "Lysosomes are acidic, membrane-bound sacs of digestive enzymes that break down worn-out cell parts and material taken in from outside.",
      analogy:
        "Like a recycling and waste-processing plant, they take apart what is no longer needed and return the useful building blocks to the cell.",
      details: [
        "Lysosomes contain acid hydrolases, enzymes that digest proteins, lipids, carbohydrates and nucleic acids. The interior is kept acidic (around pH 4.5-5), and the enzymes work best at that acidity, which helps protect the rest of the cell if one leaks.",
        "They digest material brought in by endocytosis, including bacteria engulfed by white blood cells, and recycle worn-out organelles in a process called autophagy. The released small molecules are reused by the cell.",
      ],
      functions: [
        "Digest large molecules into reusable building blocks.",
        "Recycle damaged or worn-out organelles (autophagy).",
        "Destroy bacteria and debris engulfed by the cell.",
      ],
      facts: [
        "Lysosomal storage diseases, such as Tay-Sachs disease, occur when a lysosomal enzyme is missing or faulty.",
        "Lysosomes are most prominent in animal cells; plant cells use a large vacuole for similar jobs.",
      ],
      relationships: [
        { id: "golgi", text: "Its enzymes are tagged and delivered by the Golgi." },
        { id: "vesicles", text: "Fuses with vesicles carrying material taken in from outside the cell." },
        { id: "membrane", text: "Receives material that entered the cell by endocytosis at the membrane." },
      ],
    },

    vesicles: {
      name: "Vesicles",
      mapName: "Vesicles",
      cityRole: "Transport and Delivery Vehicles",
      shortRole: "Delivery Vehicles",
      kind: "organelle",
      accent: "biology",
      sprite: "vesicle-depot",
      aliases: ["transport", "secretion", "exocytosis", "endocytosis", "cargo", "delivery"],
      summary:
        "Vesicles are small membrane-bound sacs that carry proteins, lipids and other cargo between compartments and to the cell surface.",
      analogy:
        "Like delivery vehicles, they pick up cargo at one building, travel along the roads and unload at another.",
      details: [
        "A vesicle forms when a patch of membrane buds off a compartment, trapping cargo inside. It later fuses with a target membrane and releases its contents. Different vesicle coats and surface markers help ensure each one reaches the correct destination.",
        "Vesicles move along cytoskeleton tracks, pulled by motor proteins. They carry cargo between the ER and Golgi, out of the cell (exocytosis) and into it (endocytosis).",
      ],
      functions: [
        "Transport cargo between the ER, Golgi, lysosomes and the cell membrane.",
        "Release material outside the cell by exocytosis.",
        "Bring material in by endocytosis.",
        "Store substances such as hormones or neurotransmitters until they are needed.",
      ],
      facts: [
        "The 2013 Nobel Prize in Physiology or Medicine recognised discoveries of how vesicle traffic is regulated.",
        "In the City, the small round sprites moving along the roads illustrate vesicles in transit.",
      ],
      relationships: [
        { id: "golgi", text: "Carry finished products out of the Golgi." },
        { id: "cytoskeleton", text: "Travel along cytoskeleton tracks pulled by motor proteins." },
        { id: "membrane", text: "Fuse with the cell membrane to release their contents (exocytosis)." },
      ],
    },

    membrane: {
      name: "Cell Membrane",
      mapName: "Cell Membrane",
      cityRole: "City Boundary",
      shortRole: "City Boundary",
      kind: "environment",
      accent: "accent",
      sprite: "membrane",
      aliases: ["plasma membrane", "phospholipid", "bilayer", "boundary", "transport proteins"],
      summary:
        "The cell membrane is a thin lipid bilayer with embedded proteins that separates the cell from its surroundings and controls what passes through.",
      analogy:
        "Like the city boundary with its gates and checkpoints, it keeps the inside organised and lets only the right things in and out.",
      details: [
        "Its basic structure is a double layer of phospholipids. Each phospholipid has a water-loving head facing outward and water-avoiding tails facing inward, so the membrane forms a barrier to most water-soluble substances. Proteins float in this layer, a pattern described by the fluid mosaic model.",
        "The membrane is selectively permeable: small uncharged molecules can slip through, while ions and larger molecules cross using channel and carrier proteins. Some of these transporters use ATP to move substances against a concentration gradient.",
      ],
      functions: [
        "Acts as a selective barrier between the cell and its environment.",
        "Moves substances in and out through channels, carriers and pumps.",
        "Detects signals through receptor proteins.",
        "Allows cells to recognise and attach to one another.",
      ],
      facts: [
        "The membrane is only about 7-10 nanometres thick.",
        "In animal cells, cholesterol tucked between the phospholipids helps keep the membrane fluid but stable.",
      ],
      relationships: [
        { id: "vesicles", text: "Exchanges material with vesicles during exocytosis and endocytosis." },
        { id: "cytoskeleton", text: "Is supported from the inside by the cytoskeleton." },
        { id: "smooth-er", text: "Gets many of its lipids from the smooth ER." },
      ],
    },

    cytoplasm: {
      name: "Cytoplasm",
      mapName: "Cytoplasm",
      cityRole: "City Environment",
      shortRole: "City Environment",
      kind: "environment",
      accent: "accent",
      sprite: "cytoplasm",
      aliases: ["cytosol", "gel", "fluid", "glycolysis", "interior"],
      summary:
        "The cytoplasm is everything inside the cell membrane apart from the nucleus: the watery cytosol plus the organelles suspended in it.",
      analogy:
        "Like the ground, air and open spaces of a city, it is the medium in which every building stands and every delivery travels.",
      details: [
        "The fluid part, the cytosol, is mostly water with dissolved ions, small molecules and a great many proteins. It is crowded and gel-like, not a thin watery solution.",
        "Many reactions take place here, including glycolysis and protein synthesis by free ribosomes. It also holds the organelles in place and lets molecules reach them by diffusion or by transport along the cytoskeleton.",
      ],
      functions: [
        "Provides the medium where many metabolic reactions occur.",
        "Hosts glycolysis, the first stage of glucose breakdown.",
        "Holds organelles and supports free ribosomes making proteins.",
        "Allows molecules to diffuse between organelles.",
      ],
      facts: [
        "'Cytosol' means the fluid itself, while 'cytoplasm' includes the organelles within it (and in most definitions excludes the nucleus).",
        "The cytosol is so crowded with macromolecules that diffusion in it is slower than in plain water.",
      ],
      relationships: [
        { id: "ribosomes", text: "Free ribosomes make proteins here." },
        { id: "mitochondria", text: "Glycolysis here supplies fuel for the mitochondria." },
        { id: "cytoskeleton", text: "Is organised and supported by the cytoskeleton." },
      ],
    },

    cytoskeleton: {
      name: "Cytoskeleton",
      mapName: "Cytoskeleton",
      cityRole: "Internal Support and Transport Network",
      shortRole: "Road Network",
      kind: "environment",
      accent: "accent",
      sprite: "cytoskeleton",
      aliases: ["microtubules", "actin", "filaments", "roads", "motor proteins", "kinesin", "dynein"],
      summary:
        "The cytoskeleton is a network of protein filaments that gives the cell its shape, anchors organelles and provides tracks for transport.",
      analogy:
        "Like the road network and the building frames of a city, it supports structures and carries traffic between them.",
      details: [
        "It has three main components: microfilaments (actin), intermediate filaments and microtubules. Microtubules are hollow tubes of tubulin about 25 nm wide that grow and shrink quickly.",
        "Motor proteins such as kinesin and dynein carry vesicles and organelles along microtubules. The cytoskeleton also drives changes in cell shape, cell movement and the separation of chromosomes during cell division.",
      ],
      functions: [
        "Maintains the shape of the cell and resists mechanical stress.",
        "Anchors organelles in place and moves them when needed.",
        "Provides tracks for motor proteins carrying vesicles.",
        "Enables cell movement and forms the spindle used in cell division.",
      ],
      facts: [
        "Microtubules are dynamic: they continually lengthen and shorten.",
        "The roads in the City are a simplified picture; in a real cell the network is a dense, constantly changing mesh.",
      ],
      relationships: [
        { id: "vesicles", text: "Provides the tracks along which vesicles are carried." },
        { id: "mitochondria", text: "Positions mitochondria where energy is needed." },
        { id: "membrane", text: "Supports the cell membrane from the inside." },
      ],
    },
  },
};
