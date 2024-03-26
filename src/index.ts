import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { Menu } from '@lumino/widgets';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { EditorLanguageRegistry } from '@jupyterlab/codemirror';

function addKernelMenuItems(
  app: any,
  serviceManager: any,
  palette: any,
  mainMenu: IMainMenu
) {
  const { commands } = app;
  const menu = new Menu({ commands: app.commands });
  menu.title.label = 'Available Kernels Menu';
  mainMenu.addMenu(menu);

  Object.entries(serviceManager.kernelspecs.specs.kernelspecs).forEach(
    ([key, value]: [string, any]) => {
      let count: number = 0;
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
      const startConsoleCommand = `widgets:start-console-${key}`;

      commands.addCommand(startConsoleCommand, {
        label: `New ${key} console`,
        execute: async () => {
          count++;
          try {
            await commands.execute('console:create', {
              name: `Console ${count}`,
              kernelPreference: { name: key }
            });
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
    const { serviceManager } = app;

    serviceManager.ready.then(() => {
      serviceManager.kernelspecs.ready.then(() => {
        addKernelMenuItems(app, serviceManager, palette, mainMenu);
      });
    });
  }
};

export default plugin;
