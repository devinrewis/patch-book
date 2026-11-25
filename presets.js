/**
 * Starter module templates & demo ARP 2600 manual-style patchbook pages.
 */
window.DEFAULT_DATA = {
  // Reusable module templates in the sidebar palette
  templates: [
    {
      id: "tpl_vco",
      title: "VCO",
      category: "SOURCE",
      params: [
        { name: "COARSE", type: "knob", value: 0.5 },
        { name: "FINE", type: "knob", value: 0.5 },
        { name: "PW", type: "slider", value: 0.35 },
        { name: "WAVE", type: "switch3", value: 0, labels: ["SAW", "PLS", "TRI"] },
      ],
    },
    {
      id: "tpl_vcf",
      title: "VCF 24dB",
      category: "FILTER",
      params: [
        { name: "CUTOFF", type: "slider", value: 0.45 },
        { name: "RESO", type: "slider", value: 0.3 },
        { name: "ENV AMT", type: "knob", value: 0.65 },
        { name: "MODE", type: "switch3", value: 0, labels: ["LP", "BP", "HP"] },
      ],
    },
    {
      id: "tpl_vca",
      title: "VCA",
      category: "AMP",
      params: [
        { name: "GAIN", type: "slider", value: 0.8 },
        { name: "INIT LVL", type: "knob", value: 0.0 },
        { name: "RESP", type: "switch3", value: 1, labels: ["LIN", "EXP", "DRN"] },
      ],
    },
    {
      id: "tpl_adsr",
      title: "ADSR ENV",
      category: "CV",
      params: [
        { name: "ATTACK", type: "slider", value: 0.15 },
        { name: "DECAY", type: "slider", value: 0.55 },
        { name: "SUSTAIN", type: "slider", value: 0.6 },
        { name: "RELEASE", type: "slider", value: 0.4 },
      ],
    },
    {
      id: "tpl_lfo",
      title: "LFO",
      category: "CV",
      params: [
        { name: "RATE", type: "knob", value: 0.35 },
        { name: "DEPTH", type: "knob", value: 0.4 },
        { name: "SHAPE", type: "switch3", value: 0, labels: ["SIN", "TRI", "SQR"] },
      ],
    },
    {
      id: "tpl_noise",
      title: "NOISE / S&H",
      category: "SOURCE",
      params: [
        { name: "COLOR", type: "switch3", value: 0, labels: ["WHT", "PNK", "RED"] },
        { name: "CLK RATE", type: "knob", value: 0.5 },
        { name: "LAG", type: "knob", value: 0.15 },
      ],
    },
    {
      id: "tpl_mixer",
      title: "MIXER",
      category: "UTIL",
      params: [
        { name: "CH 1", type: "slider", value: 0.8 },
        { name: "CH 2", type: "slider", value: 0.65 },
        { name: "CH 3", type: "slider", value: 0.0 },
      ],
    },
    {
      id: "tpl_fx",
      title: "REVERB / OUT",
      category: "OUT",
      params: [
        { name: "MIX", type: "knob", value: 0.3 },
        { name: "DECAY", type: "knob", value: 0.55 },
        { name: "OUT LVL", type: "slider", value: 0.85 },
      ],
    },
  ],

  // Demo Patchbook Pages (Audio flows Left -> Right; CV flows Bottom -> Top)
  patches: [
    {
      id: "patch_1",
      name: "01 - Intro Brass Pad",
      modules: [
        {
          id: "m_vco1",
          title: "VCO 1",
          x: 80,
          y: 80,
          params: [
            { id: "p1", name: "OCTAVE", type: "switch3", value: 1, labels: ["16'", "8'", "4'"] },
            { id: "p2", name: "FINE", type: "knob", value: 0.52 },
            { id: "p3", name: "WAVE", type: "switch3", value: 0, labels: ["SAW", "PLS", "TRI"] },
          ],
        },
        {
          id: "m_vco2",
          title: "VCO 2",
          x: 80,
          y: 300,
          params: [
            { id: "p4", name: "OCTAVE", type: "switch3", value: 1, labels: ["16'", "8'", "4'"] },
            { id: "p5", name: "DETUNE", type: "knob", value: 0.58 },
            { id: "p6", name: "PW", type: "slider", value: 0.42 },
          ],
        },
        {
          id: "m_vcf",
          title: "VCF 24dB",
          x: 420,
          y: 120,
          params: [
            { id: "p7", name: "CUTOFF", type: "slider", value: 0.38 },
            { id: "p8", name: "RESO", type: "slider", value: 0.25 },
            { id: "p9", name: "ENV AMT", type: "knob", value: 0.72 },
            { id: "p10", name: "KBD TRK", type: "switch3", value: 1, labels: ["OFF", "50%", "100%"] },
          ],
        },
        {
          id: "m_vca",
          title: "VCA / OUT",
          x: 780,
          y: 140,
          params: [
            { id: "p11", name: "GAIN", type: "slider", value: 0.82 },
            { id: "p12", name: "DRIVE", type: "knob", value: 0.2 },
            { id: "p13", name: "RESP", type: "switch3", value: 1, labels: ["LIN", "EXP", "HOLD"] },
          ],
        },
        {
          id: "m_lfo",
          title: "LFO (VIBRATO)",
          x: 80,
          y: 560,
          params: [
            { id: "p14", name: "RATE", type: "knob", value: 0.32 },
            { id: "p15", name: "DEPTH", type: "knob", value: 0.18 },
            { id: "p16", name: "SHAPE", type: "switch3", value: 0, labels: ["SIN", "TRI", "SQR"] },
          ],
        },
        {
          id: "m_adsr_f",
          title: "ADSR (FILTER)",
          x: 420,
          y: 440,
          params: [
            { id: "p17", name: "ATTACK", type: "slider", value: 0.34 },
            { id: "p18", name: "DECAY", type: "slider", value: 0.62 },
            { id: "p19", name: "SUSTAIN", type: "slider", value: 0.5 },
            { id: "p20", name: "RELEASE", type: "slider", value: 0.55 },
          ],
        },
        {
          id: "m_adsr_a",
          title: "ADSR (AMP)",
          x: 780,
          y: 440,
          params: [
            { id: "p21", name: "ATTACK", type: "slider", value: 0.22 },
            { id: "p22", name: "DECAY", type: "slider", value: 0.45 },
            { id: "p23", name: "SUSTAIN", type: "slider", value: 0.78 },
            { id: "p24", name: "RELEASE", type: "slider", value: 0.6 },
          ],
        },
      ],
      connections: [
        { id: "c1", type: "audio", from: "m_vco1", to: "m_vcf", outLabel: "SAW OUT", inLabel: "AUD IN 1" },
        { id: "c2", type: "audio", from: "m_vco2", to: "m_vcf", outLabel: "PLS OUT", inLabel: "AUD IN 2" },
        { id: "c3", type: "audio", from: "m_vcf", to: "m_vca", outLabel: "LP OUT", inLabel: "SIG IN" },
        { id: "c4", type: "cv", from: "m_lfo", to: "m_vco2", outLabel: "SIN CV", inLabel: "PWM CV" },
        { id: "c5", type: "cv", from: "m_adsr_f", to: "m_vcf", outLabel: "ENV OUT", inLabel: "CUTOFF CV" },
        { id: "c6", type: "cv", from: "m_adsr_a", to: "m_vca", outLabel: "ENV OUT", inLabel: "GAIN CV" },
      ],
    },

    {
      id: "patch_2",
      name: "02 - Acid Bass",
      modules: [
        {
          id: "m2_vco",
          title: "VCO 1",
          x: 100,
          y: 120,
          params: [
            { id: "p2_1", name: "OCTAVE", type: "switch3", value: 0, labels: ["32'", "16'", "8'"] },
            { id: "p2_2", name: "WAVE", type: "switch3", value: 0, labels: ["SAW", "SQR", "SUB"] },
            { id: "p2_3", name: "GLIDE", type: "knob", value: 0.28 },
          ],
        },
        {
          id: "m2_vcf",
          title: "DIODE VCF",
          x: 460,
          y: 100,
          params: [
            { id: "p2_4", name: "CUTOFF", type: "slider", value: 0.24 },
            { id: "p2_5", name: "RESO", type: "slider", value: 0.78 },
            { id: "p2_6", name: "ENV MOD", type: "knob", value: 0.85 },
            { id: "p2_7", name: "ACCENT", type: "knob", value: 0.66 },
          ],
        },
        {
          id: "m2_vca",
          title: "VCA / DIST",
          x: 820,
          y: 120,
          params: [
            { id: "p2_8", name: "DRIVE", type: "knob", value: 0.62 },
            { id: "p2_9", name: "LEVEL", type: "slider", value: 0.85 },
          ],
        },
        {
          id: "m2_env",
          title: "DECAY ENV",
          x: 460,
          y: 420,
          params: [
            { id: "p2_10", name: "ATTACK", type: "slider", value: 0.02 },
            { id: "p2_11", name: "DECAY", type: "slider", value: 0.36 },
            { id: "p2_12", name: "TRIG", type: "switch3", value: 2, labels: ["OFF", "GATE", "ACC"] },
          ],
        },
      ],
      connections: [
        { id: "c2_1", type: "audio", from: "m2_vco", to: "m2_vcf", outLabel: "SAW", inLabel: "IN" },
        { id: "c2_2", type: "audio", from: "m2_vcf", to: "m2_vca", outLabel: "LP OUT", inLabel: "DRIVE IN" },
        { id: "c2_3", type: "cv", from: "m2_env", to: "m2_vcf", outLabel: "ENV +", inLabel: "FREQ CV" },
      ],
    },

    {
      id: "patch_3",
      name: "03 - Outro Drone",
      modules: [
        {
          id: "m3_noise",
          title: "NOISE / S&H",
          x: 100,
          y: 120,
          params: [
            { id: "p3_1", name: "COLOR", type: "switch3", value: 1, labels: ["WHT", "PNK", "RED"] },
            { id: "p3_2", name: "LEVEL", type: "slider", value: 0.55 },
          ],
        },
        {
          id: "m3_vcf",
          title: "RESONANT VCF",
          x: 460,
          y: 110,
          params: [
            { id: "p3_3", name: "CUTOFF", type: "slider", value: 0.52 },
            { id: "p3_4", name: "RESO", type: "slider", value: 0.92 },
            { id: "p3_5", name: "MODE", type: "switch3", value: 1, labels: ["LP", "BP", "HP"] },
          ],
        },
        {
          id: "m3_rev",
          title: "SPRING REVERB",
          x: 820,
          y: 120,
          params: [
            { id: "p3_6", name: "MIX", type: "knob", value: 0.72 },
            { id: "p3_7", name: "TONE", type: "knob", value: 0.4 },
            { id: "p3_8", name: "OUT", type: "slider", value: 0.75 },
          ],
        },
        {
          id: "m3_lfo",
          title: "SLOW LFO",
          x: 460,
          y: 410,
          params: [
            { id: "p3_9", name: "RATE", type: "knob", value: 0.08 },
            { id: "p3_10", name: "DEPTH", type: "knob", value: 0.45 },
            { id: "p3_11", name: "SHAPE", type: "switch3", value: 0, labels: ["SIN", "TRI", "RND"] },
          ],
        },
      ],
      connections: [
        { id: "c3_1", type: "audio", from: "m3_noise", to: "m3_vcf", outLabel: "PINK OUT", inLabel: "AUD IN" },
        { id: "c3_2", type: "audio", from: "m3_vcf", to: "m3_rev", outLabel: "BP OUT", inLabel: "REV IN" },
        { id: "c3_3", type: "cv", from: "m3_lfo", to: "m3_vcf", outLabel: "SLOW SIN", inLabel: "CUTOFF CV" },
      ],
    },
  ],
};
