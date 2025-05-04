// Mock of Obsidian API for testing
const obsidianMock = {
  Plugin: class {
    constructor() {}
    registerEvent() { return { unregister: () => {} }; }
    registerInterval() { return { unregister: () => {} }; }
    loadData() { return Promise.resolve(null); }
    saveData() { return Promise.resolve(); }
    addRibbonIcon() { return { remove: () => {} }; }
    addStatusBarItem() { return { remove: () => {}, empty: () => {}, createDiv: () => mockElement }; }
    addCommand() {}
    addSettingTab() {}
  },
  PluginSettingTab: class {
    constructor() {}
    display() {}
  },
  Setting: class {
    constructor() {
      return {
        setName: () => mockSetting,
        setDesc: () => mockSetting,
        addText: () => mockSetting,
        addToggle: () => mockSetting,
        addSlider: () => mockSetting,
        addButton: () => mockSetting,
      };
    }
  },
  TFile: class {
    constructor(path, size) {
      this.path = path;
      this.stat = { mtime: Date.now(), size };
    }
  },
  TFolder: class {
    constructor(path) {
      this.path = path;
    }
  },
  Notice: class {
    constructor(message) {
      this.message = message;
    }
    setMessage(message) {
      this.message = message;
    }
  },
  setIcon: (el, icon) => {},
  requestUrl: async () => ({ text: '', json: {}, arrayBuffer: new ArrayBuffer(0), status: 200 }),
  normalizePath: (path) => path,
};

// Mock HTML Element
const mockElement = {
  empty: () => mockElement,
  setText: () => mockElement,
  createDiv: () => mockElement,
  createEl: () => mockElement,
  addEventListener: () => {},
  style: {},
  addClass: () => mockElement,
  removeClass: () => mockElement,
  toggleClass: () => mockElement,
};

// Mock Setting
const mockSetting = {
  setName: () => mockSetting,
  setDesc: () => mockSetting,
  addText: (cb) => { cb && cb({ setValue: () => ({}), setPlaceholder: () => ({}), onChange: () => ({}), setType: () => ({}) }); return mockSetting; },
  addToggle: (cb) => { cb && cb({ setValue: () => ({}), onChange: () => ({}) }); return mockSetting; },
  addSlider: (cb) => { cb && cb({ setValue: () => ({}), setLimits: () => ({}), setDynamicTooltip: () => ({}), onChange: () => ({}) }); return mockSetting; },
  addButton: (cb) => { cb && cb({ setButtonText: () => ({}), setCta: () => ({}), onClick: () => ({}), setDisabled: () => ({}) }); return mockSetting; },
};

module.exports = obsidianMock;