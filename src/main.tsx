import { render } from 'solid-js/web';
import App from '@/scenes/App';

async function bootstrap() {
  render(() => <App />, document.getElementById('app')!);
}

bootstrap();
