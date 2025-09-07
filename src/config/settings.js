const settings = {
  // Font sizes (easily adjustable)
  fonts: {
    titleSize: '4rem',        // OATS title font size
    subtitleSize: '1.2rem',   // Offline Assessment Task Suite font size
    bodySize: '1rem'          // General body text font size
  },
  
  // Colors
  colors: {
    background: '#ffffff',    // White background
    text: '#000000',         // Black text
    accent: '#333333'        // Dark gray for accents
  },
  
  // Loading settings
  loading: {
    duration: 3000,          // Loading duration in milliseconds
    spinnerSize: '40px'      // Loading spinner size
  },
  
  // Window settings
  window: {
    loading: {
      width: 800,
      height: 600
    },
    main: {
      width: 1200,
      height: 800
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = settings;
}