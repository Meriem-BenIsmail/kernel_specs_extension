import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { KernelManager } from '@jupyterlab/services';
import { ICommandPalette } from '@jupyterlab/apputils';
import { Menu, Widget } from '@lumino/widgets';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { EditorLanguageRegistry } from '@jupyterlab/codemirror';
import { ConsolePanel } from '@jupyterlab/console';
import { SessionContext } from '@jupyterlab/apputils';

class KernelInfoWidget extends Widget {
  constructor(serviceManager: any) {
    super();
    this.addClass('kernel-info-widget');
    this.id = `kernel-info-widget-${Date.now()}`;
    this.title.label = 'Kernel Information';
    this.title.closable = true;
    this.fetchKernelInfo(serviceManager);
  }
  async fetchKernelInfo(serviceManager: any) {
    try {
      const kernelSpecs = await serviceManager.kernelspecs.specs;
      const kernelspecs = kernelSpecs.kernelspecs;

      const content = document.createElement('div');
      content.classList.add('kernels-container');
      Object.entries(kernelspecs).forEach(([key, value]: [string, any]) => {
        console.log(value);
        const logo = value.resources['logo-64x64'];
        const kernelDiv = document.createElement('div');
        kernelDiv.classList.add('kernel-info');
        kernelDiv.innerHTML = `
            <p>${value.display_name}</p>
            <div class="kernel-logo">
              <img src="${logo}" alt="${value.display_name}"></img>
            </div>
            `;
        kernelDiv.addEventListener('click', async () => {
          try {
            const kernelManager = new KernelManager();
            await kernelManager.startNew({ name: key });
            console.log(`Kernel '${key}' started successfully.`);
          } catch (error) {
            console.error(`Error starting kernel '${key}':`, error);
          }
        });

        content.appendChild(kernelDiv);
      });
      this.node.appendChild(content);
    } catch (error) {
      console.error('Error retrieving kernel information:', error);
      this.node.textContent = 'Error retrieving kernel information';
    }
  }
}

function addKernelMenuItems(
  app: any,
  serviceManager: any,
  palette: any,
  mainMenu: IMainMenu
) {
  const { commands, shell } = app;
  const menu = new Menu({ commands: app.commands });
  menu.title.label = 'Available Kernels Menu';
  mainMenu.addMenu(menu);
  Object.entries(serviceManager.kernelspecs.specs.kernelspecs).forEach(
    ([key, value]: [string, any]) => {
      const kernelMenu = new Menu({ commands: app.commands });
      kernelMenu.title.label = value.display_name;
      const language =
        serviceManager.kernelspecs.specs.kernelspecs[key].language;
      const defaultLanguages = EditorLanguageRegistry.getDefaultLanguages();
      let fileExtensions: string[] | any;

      defaultLanguages.forEach(item => {
        if (item.name.toLocaleLowerCase() === language.toLocaleLowerCase()) {
          fileExtensions = item.extensions;
        }
      });

      const startNotebookCommand = `widgets:start-notebook-${key}`;
      commands.addCommand(startNotebookCommand, {
        label: `New ${key} notebook`,
        execute: async () => {
          const result = await app.commands.execute('docmanager:new-untitled', {
            path: '.',
            type: 'notebook'
          });
          await app.commands.execute('docmanager:open', {
            path: result.path,
            factory: 'Notebook',
            kernel: {
              name: key
            }
          });
        }
      });
      let contentFactory: ConsolePanel.IContentFactory;

      const startConsoleCommand = `widgets:start-console-${key}`;
      commands.addCommand(startConsoleCommand, {
        label: `New ${key} console`,
        execute: async () => {
          try {
            const sessionManager = app.serviceManager.sessions;
            const specsManager = app.serviceManager.kernelspecs;
            const rendermime = app.rendermime;
            const manager = app.shell.widgets;
            const mimeTypeService = app.docRegistry.mimeTypeService;
            /* const kernel = await serviceManager.sessions.startNew({
              name: key,
              type: 'console',
              path: '.'
            });*/
            const sessionContext = new SessionContext({
              sessionManager: sessionManager,
              specsManager: specsManager,
              kernelPreference: serviceManager.sessions.startNew({
                name: key,
                type: 'console',
                path: '.'
              })
            });

            await sessionContext.ready;

            const panel = new ConsolePanel({
              rendermime: rendermime,
              contentFactory: contentFactory,
              manager: manager,
              mimeTypeService: mimeTypeService,
              sessionContext: sessionContext
            });
            shell.add(panel, 'main');
            shell.activateById(panel.id);
            console.log(panel.id);
          } catch (error) {
            console.error('Error starting console:', error);
          }
        }
      });

      kernelMenu.addItem({ command: startNotebookCommand });
      kernelMenu.addItem({ command: startConsoleCommand });

      const fileSubMenu = new Menu({ commands: app.commands });
      fileSubMenu.title.label = `Open a ${key} file`;
      fileExtensions.forEach((extension: string) => {
        const openFileCommand = `widgets:open-file-${key}-${extension}`;
        commands.addCommand(openFileCommand, {
          label: `${extension} file`,
          execute: async () => {
            try {
              const model = await serviceManager.contents.newUntitled({
                type: 'file',
                path: '.',
                ext: extension,
                language: language
              });

              app.commands.execute('docmanager:open', {
                path: model.path
              });
            } catch (error) {
              console.error('Error creating untitled file:', error);
            }
          }
        });
        fileSubMenu.addItem({ command: openFileCommand });
      });

      kernelMenu.addItem({ type: 'submenu', submenu: fileSubMenu });

      menu.addItem({ type: 'submenu', submenu: kernelMenu });
    }
  );
}

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'available_kernel_menu:plugin',
  description: 'A JupyterLab extension showing the available kernels.',
  autoStart: true,
  optional: [ISettingRegistry],
  requires: [ICommandPalette, IMainMenu],
  activate: (app, palette, mainMenu: IMainMenu) => {
    const { commands, shell, serviceManager } = app;
    const openKernelInfoCommand = 'widgets:open-kernel-info-tab';
    commands.addCommand(openKernelInfoCommand, {
      label: 'Get Available Kernels',
      caption: 'Open the Widgets to get available kernels',
      execute: () => {
        const widget = new KernelInfoWidget(serviceManager);
        shell.add(widget, 'main');
      }
    });

    palette.addItem({
      command: openKernelInfoCommand,
      category: 'Kernel Info Extension Examples'
    });

    serviceManager.ready.then(() => {
      serviceManager.kernelspecs.ready.then(() => {
        addKernelMenuItems(app, serviceManager, palette, mainMenu);
      });
    });
  }
};

export default plugin;
