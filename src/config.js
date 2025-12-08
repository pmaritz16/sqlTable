// Config manager that uses Electron IPC
export default class ConfigManager {
  constructor(electronAPI) {
    this.api = electronAPI;
    this.defaultConfigPath = null;
    this.defaultConfig = {
      databasePath: '',
      csvFiles: []
    };
  }

  async initialize() {
    this.defaultConfigPath = await this.api.getDefaultConfigPath();
    const defaultDbPath = await this.api.getDefaultDatabasePath();
    this.defaultConfig.databasePath = defaultDbPath;
  }

  getDefaultConfigPath() {
    return this.defaultConfigPath;
  }

  async createDefaultConfig() {
    try {
      const result = await this.api.createDefaultConfig(this.defaultConfig);
      // result is false if file already exists, true if created successfully
      return result;
    } catch (error) {
      console.error('Error creating default config:', error);
      return false;
    }
  }

  async loadConfig(configPath) {
    try {
      const config = await this.api.loadConfig(configPath);
      return config;
    } catch (error) {
      console.error('Error loading config:', error);
      return null;
    }
  }

  async saveConfig(configPath, config) {
    try {
      await this.api.saveConfig(configPath, config);
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      return false;
    }
  }

  validateConfig(config) {
    if (!config) return false;
    if (!config.databasePath) return false;
    if (!Array.isArray(config.csvFiles)) return false;
    return true;
  }

  async selectConfigFile() {
    try {
      const filePath = await this.api.selectConfigFile({
        title: 'Select Config File',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      return filePath;
    } catch (error) {
      console.error('Error selecting config file:', error);
      return null;
    }
  }

  async readConfigFileRaw(configPath) {
    try {
      const content = await this.api.readConfigFileRaw(configPath);
      return content;
    } catch (error) {
      console.error('Error reading config file raw:', error);
      return null;
    }
  }
}

