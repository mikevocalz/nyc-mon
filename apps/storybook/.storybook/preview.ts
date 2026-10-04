import type { Preview } from '@storybook/react-vite';
import '../globals.css';

const preview: Preview = {
  initialGlobals: { theme: 'dark', motion: 'full' },
  parameters: {
    // NeonBlade/Index first: the map from every NeonBlade component to its port.
    options: {
      storySort: {
        order: ['NeonBlade', ['Index', ['All components', '*']], 'Charts', ['All charts', '*'], '*'],
      },
    },

    controls: { matchers: { color: /(background|color)$/i } },

    viewport: {
      options: {
        phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
        tabletPortrait: { name: 'Tablet portrait', styles: { width: '834px', height: '1194px' } },
        tabletLandscape: { name: 'Tablet landscape', styles: { width: '1194px', height: '834px' } },
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
  globalTypes: {
    theme: {
      description: 'Color scheme',
      toolbar: { title: 'Theme', items: ['system', 'light', 'dark'] },
    },
    motion: {
      description: 'Reduced motion',
      toolbar: { title: 'Motion', items: ['full', 'reduced'] },
    },
  },
  decorators: [
    (Story, ctx) => {
      const t = ctx.globals.theme;
      document.documentElement.style.colorScheme =
        t === 'light' || t === 'dark' ? t : 'light dark';
      // reduced-motion toggle: kill animations/transitions globally
      let style = document.getElementById('sb-reduced-motion');
      if (ctx.globals.motion === 'reduced' && !style) {
        style = document.createElement('style');
        style.id = 'sb-reduced-motion';
        style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
        document.head.appendChild(style);
      } else if (ctx.globals.motion !== 'reduced' && style) {
        style.remove();
      }
      // Canvas follows the theme — without this, dark-mode text tokens wash
      // out against Storybook's white preview body.
      document.body.style.background = 'var(--color-surface)';
      document.body.style.color = 'var(--color-text)';
      return Story();
    },
  ],
};

export default preview;
