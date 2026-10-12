"use strict";

/*
 * Challenge categories and questions. Each question has exactly one correct
 * answer: `answer` is the index into `options`. Ids are stable because saved
 * progress is keyed by category id.
 */
window.CellCity = window.CellCity || {};
window.CellCity.data = window.CellCity.data || {};

window.CellCity.data.challenges = {
  categories: [
    {
      id: "identify-organelle",
      title: "Identify the Organelle",
      blurb: "Name the structure from its job in a eukaryotic cell.",
      sprite: "mitochondria",
      questions: [
        {
          id: "org-1",
          prompt: "Which organelle contains most of a eukaryotic cell's DNA?",
          options: ["Golgi apparatus", "Nucleus", "Lysosome", "Smooth ER"],
          answer: 1,
          explanation:
            "The nucleus stores most of the cell's DNA inside a double membrane. (Mitochondria also hold a small amount of their own DNA.)",
        },
        {
          id: "org-2",
          prompt: "Which organelle produces most of the cell's ATP by aerobic respiration?",
          options: ["Mitochondria", "Ribosomes", "Lysosomes", "Vesicles"],
          answer: 0,
          explanation:
            "Most ATP is made in mitochondria, using the folded inner membrane (cristae) and ATP synthase.",
        },
        {
          id: "org-3",
          prompt: "Which organelle contains acid hydrolase enzymes that digest worn-out cell parts?",
          options: ["Nucleolus", "Rough ER", "Lysosome", "Golgi apparatus"],
          answer: 2,
          explanation:
            "Lysosomes are acidic sacs of digestive enzymes that break down damaged organelles and engulfed material.",
        },
        {
          id: "org-4",
          prompt: "Which structure is a stack of flattened sacs that modifies, sorts and packages proteins for delivery?",
          options: ["Smooth ER", "Golgi apparatus", "Mitochondrion", "Ribosome"],
          answer: 1,
          explanation:
            "The Golgi apparatus receives proteins from the ER, modifies them and ships them in vesicles to their destinations.",
        },
      ],
    },

    {
      id: "city-roles",
      title: "Cell → City Roles",
      blurb: "Match each cell structure to its role in Cell City.",
      sprite: "nucleus",
      questions: [
        {
          id: "city-1",
          prompt: "In Cell City, which structure plays the role of City Hall?",
          options: ["Mitochondria", "Cell membrane", "Nucleus", "Lysosomes"],
          answer: 2,
          explanation:
            "The nucleus is City Hall: it keeps the master plans (DNA) and issues instructions (mRNA).",
        },
        {
          id: "city-2",
          prompt: "Which structures are the City's Protein Factories?",
          options: ["Ribosomes", "Vesicles", "Cytoskeleton", "Golgi apparatus"],
          answer: 0,
          explanation:
            "Ribosomes assemble amino acids into proteins by reading mRNA, like small factories following a work order.",
        },
        {
          id: "city-3",
          prompt: "Which structure acts as the City Boundary, controlling what enters and leaves?",
          options: ["Cytoplasm", "Nucleus", "Cell membrane", "Smooth ER"],
          answer: 2,
          explanation:
            "The cell membrane is a selectively permeable boundary, much like a city border with gates.",
        },
        {
          id: "city-4",
          prompt: "Which cell structures are the City's delivery vehicles?",
          options: ["Ribosomes", "Vesicles", "Mitochondria", "Nucleolus"],
          answer: 1,
          explanation:
            "Vesicles carry cargo between compartments, such as from the ER to the Golgi and on to the cell surface.",
        },
      ],
    },

    {
      id: "dna-rna",
      title: "DNA & RNA Fundamentals",
      blurb: "Bases, sugars and the differences between the two nucleic acids.",
      sprite: "flask",
      questions: [
        {
          id: "dna-1",
          prompt: "In DNA, which base pairs with adenine (A)?",
          options: ["Guanine (G)", "Cytosine (C)", "Uracil (U)", "Thymine (T)"],
          answer: 3,
          explanation:
            "In DNA, A pairs with T and G pairs with C. RNA has uracil (U) in place of thymine.",
        },
        {
          id: "dna-2",
          prompt: "Which base is found in RNA but not in DNA?",
          options: ["Uracil", "Thymine", "Adenine", "Guanine"],
          answer: 0,
          explanation:
            "RNA uses uracil (U) where DNA uses thymine (T). Both contain A, C and G.",
        },
        {
          id: "dna-3",
          prompt: "Which sugar is part of the DNA backbone?",
          options: ["Ribose", "Glucose", "Deoxyribose", "Fructose"],
          answer: 2,
          explanation:
            "DNA contains deoxyribose, while RNA contains ribose. The name 'deoxy' means one oxygen atom fewer.",
        },
        {
          id: "dna-4",
          prompt: "Which statement best describes the usual structure of DNA and mRNA in a cell?",
          options: [
            "DNA is double-stranded and mRNA is single-stranded",
            "DNA is single-stranded and mRNA is double-stranded",
            "Both are normally double-stranded",
            "Both are normally single-stranded",
          ],
          answer: 0,
          explanation:
            "DNA usually forms a double helix, while mRNA is normally a single strand copied from one DNA strand.",
        },
      ],
    },

    {
      id: "central-dogma",
      title: "Transcription & Translation",
      blurb: "Follow information from DNA to RNA to protein.",
      sprite: "ribosome-yard",
      questions: [
        {
          id: "cd-1",
          prompt: "What is made during transcription?",
          options: [
            "A protein from an mRNA template",
            "An RNA copy of a gene from a DNA template",
            "A new DNA molecule from an existing DNA molecule",
            "ATP from glucose",
          ],
          answer: 1,
          explanation:
            "Transcription copies a gene's DNA sequence into RNA. Making a protein from mRNA is translation, and copying DNA is replication.",
        },
        {
          id: "cd-2",
          prompt: "How many nucleotides make up one codon?",
          options: ["Two", "Three", "Four", "Six"],
          answer: 1,
          explanation:
            "A codon is a group of three nucleotides. With four bases there are 4 × 4 × 4 = 64 possible codons.",
        },
        {
          id: "cd-3",
          prompt: "Which amino acid does the start codon AUG code for?",
          options: ["Tryptophan", "Leucine", "Alanine", "Methionine"],
          answer: 3,
          explanation:
            "AUG codes for methionine and is the usual start codon that begins translation.",
        },
        {
          id: "cd-4",
          prompt: "Which of these codons is a stop codon?",
          options: ["UUU", "GGC", "UGA", "AUG"],
          answer: 2,
          explanation:
            "UAA, UAG and UGA are the three stop codons. They end translation and do not code for an amino acid.",
        },
        {
          id: "cd-5",
          prompt: "Where does translation take place?",
          options: ["On ribosomes", "Inside the nucleolus only", "In lysosomes", "In the cell membrane"],
          answer: 0,
          explanation:
            "Ribosomes read the mRNA codons and join the matching amino acids into a polypeptide.",
        },
      ],
    },

    {
      id: "bioinformatics",
      title: "Bioinformatics Basics",
      blurb: "Sequence calculations and what mutations do to a sequence.",
      sprite: "trophy",
      questions: [
        {
          id: "bio-1",
          prompt: "What is the GC content of the DNA sequence GCGCAT?",
          options: ["33%", "50%", "100%", "67%"],
          answer: 3,
          explanation:
            "GC content = (G + C) ÷ length × 100. GCGCAT has 4 G/C bases out of 6, so 4 ÷ 6 × 100 ≈ 67%.",
        },
        {
          id: "bio-2",
          prompt: "What is the reverse complement of the DNA sequence ATGC?",
          options: ["GCAT", "TACG", "CGTA", "ATGC"],
          answer: 0,
          explanation:
            "The complement of ATGC is TACG. Reading that backwards gives the reverse complement, GCAT.",
        },
        {
          id: "bio-3",
          prompt: "A single base is deleted from within a protein-coding sequence. What is the most likely effect on the codons that follow?",
          options: [
            "They are unchanged",
            "The reading frame shifts, changing the codons that follow",
            "Only the next codon changes",
            "The sequence becomes RNA",
          ],
          answer: 1,
          explanation:
            "Codons are read in groups of three, and one base is not a multiple of three, so deleting it usually shifts the reading frame (a frameshift) for the codons that follow. Deleting three bases at once would keep the frame.",
        },
        {
          id: "bio-4",
          prompt: "A substitution changes a codon but the new codon still codes for the same amino acid. What is this called?",
          options: ["Nonsense mutation", "Frameshift mutation", "Silent mutation", "Insertion"],
          answer: 2,
          explanation:
            "The genetic code is redundant, so some substitutions are silent: the protein's amino acid sequence does not change.",
        },
      ],
    },
  ],
};
