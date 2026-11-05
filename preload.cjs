const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('capsnip', {
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
  activateLicense: licenseKey => ipcRenderer.invoke('license:activate', licenseKey),
  chooseMedia: () => ipcRenderer.invoke('media:choose'),
  preparePreview: filePath => ipcRenderer.invoke('media:prepare-preview', filePath),
  getFilePath: file => webUtils.getPathForFile(file),
  saveProject: project => ipcRenderer.invoke('project:save', project),
  openProject: () => ipcRenderer.invoke('project:open'),
  getProjectHistory: () => ipcRenderer.invoke('project:history'),
  openProjectFromHistory: filePath => ipcRenderer.invoke('project:open-history', filePath),
  saveSubtitles: payload => ipcRenderer.invoke('subtitle:save', payload),
  engineStatus: () => ipcRenderer.invoke('engine:status'),
  transcribe: options => ipcRenderer.invoke('engine:transcribe', options),
  cancelTranscription: () => ipcRenderer.invoke('engine:cancel'),
  openPath: target => ipcRenderer.invoke('app:open-path', target),
  openExternal: target => ipcRenderer.invoke('app:open-external', target),
  chooseOutputFolder: () => ipcRenderer.invoke('app:choose-output-folder'),
  openDataFolder: kind => ipcRenderer.invoke('app:open-data-folder', kind),
  renderMotionGraphic: options => ipcRenderer.invoke('render:motion-graphic', options),
  renderSnipAi: options => ipcRenderer.invoke('render:snip-ai', options),
  exportMp4: payload => ipcRenderer.invoke('render:mp4', payload),
  cancelMotionGraphic: () => ipcRenderer.invoke('render:cancel'),
  onRenderProgress: callback => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('render:progress', listener);
    return () => ipcRenderer.removeListener('render:progress', listener);
  },
  onProgress: callback => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('engine:progress', listener);
    return () => ipcRenderer.removeListener('engine:progress', listener);
  },
});
