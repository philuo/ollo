import { render } from 'solid-js/web';
import AppRouter from '@/AppRouter';

async function bootstrap() {
  render(() => <AppRouter />, document.getElementById('app')!);
}

bootstrap();
