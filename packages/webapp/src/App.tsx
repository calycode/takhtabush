import type { ComponentType } from 'preact';
import { useEffect } from 'react';
import { Route, Router, useLocation } from 'preact-iso';
import { AppShell } from './components/app-shell';
import { RequireAuth } from './components/require-auth';
import { AgentationToolbar } from './lib/agentation';
import { CardEditor } from './routes/cards/editor';
import { DeckDetail } from './routes/decks/detail';
import { DeckEdit } from './routes/decks/edit';
import { DeckImport } from './routes/decks/import';
import { Home } from './routes/home';
import { Login } from './routes/login';
import { McpGuide } from './routes/mcp';
import { NotFound } from './routes/not-found';
import { Settings } from './routes/settings';
import { Setup } from './routes/setup';
import { StatsView } from './routes/stats';
import { StudySession } from './routes/study';

/** Wrap a route component so it requires an authenticated session. */
function guard<P extends object>(Component: ComponentType<P>): ComponentType<P> {
   return function Guarded(props: P) {
      return (
         <RequireAuth>
            <Component {...props} />
         </RequireAuth>
      );
   };
}

/** The deck library now lives on the dashboard; redirect the old route. */
function RedirectHome() {
   const { route } = useLocation();
   useEffect(() => {
      route('/');
   }, [route]);
   return null;
}

export function App() {
   return (
      <AppShell>
         <Router>
            <Route
               path='/'
               component={guard(Home)}
            />
            <Route
               path='/login'
               component={Login}
            />
            <Route
               path='/setup'
               component={Setup}
            />
            <Route
               path='/decks'
               component={RedirectHome}
            />
            <Route
               path='/decks/:id'
               component={guard(DeckDetail)}
            />
            <Route
               path='/decks/:id/edit'
               component={guard(DeckEdit)}
            />
            <Route
               path='/decks/:id/import'
               component={guard(DeckImport)}
            />
            <Route
               path='/decks/:id/cards/:cardId'
               component={guard(CardEditor)}
            />
            <Route
               path='/study/:sessionId'
               component={guard(StudySession)}
            />
            <Route
               path='/stats/:deckId'
               component={guard(StatsView)}
            />
            <Route
               path='/settings'
               component={guard(Settings)}
            />
            <Route
               path='/mcp'
               component={guard(McpGuide)}
            />
            <Route
               default
               component={NotFound}
            />
         </Router>
         <AgentationToolbar />
      </AppShell>
   );
}
