import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { esES } from "@clerk/localizations";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter, Link } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import Desk from "@/pages/desk";
import { Landing, PublicChat } from "@/pages/public";
import { Empty } from "@/components/orbit/shared";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const queryClient = new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:true}}});
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}
if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}
const clerkAppearance = {
  theme: dark,
  cssLayerName:"clerk",
  options:{logoPlacement:"inside" as const,logoLinkUrl:basePath||"/",logoImageUrl:`${window.location.origin}${basePath}/logo.svg`},
  variables:{
    colorPrimary:"#c6a15b",colorForeground:"#f7f2e8",colorMutedForeground:"#b7bec6",colorDanger:"#ef9aaa",
    colorBackground:"#243b53",colorInput:"#102542",colorInputForeground:"#f7f2e8",colorNeutral:"#b7bec6",
    fontFamily:"'DM Sans', sans-serif",borderRadius:"12px",
  },
  elements:{
    rootBox:{width:"100%",display:"flex",justifyContent:"center"},
    cardBox:{background:"#243b53",borderRadius:"18px",width:"440px",maxWidth:"100%",overflow:"hidden",border:"1px solid #3a4f63"},
    card:{boxShadow:"none",border:0,background:"transparent",borderRadius:0},
    footer:{boxShadow:"none",border:0,background:"transparent",borderRadius:0},
    headerTitle:{color:"#f7f2e8",fontFamily:"Manrope, sans-serif"},headerSubtitle:{color:"#b7bec6"},
    socialButtonsBlockButtonText:{color:"#f7f2e8"},formFieldLabel:{color:"#e1e5e8"},footerActionLink:{color:"#e3c58e"},
    footerActionText:{color:"#b7bec6"},dividerText:{color:"#b7bec6"},identityPreviewEditButton:{color:"#e3c58e"},
    formFieldSuccessText:{color:"#9bdfba"},alertText:{color:"#f7d3d9"},logoBox:{height:"60px"},logoImage:{height:"48px"},
    socialButtonsBlockButton:{background:"#102542",border:"1px solid #506174"},formButtonPrimary:{background:"#c6a15b",color:"#102542"},
    formFieldInput:{background:"#102542",color:"#f7f2e8",border:"1px solid #506174"},footerAction:{background:"transparent"},
    dividerLine:{background:"#506174"},alert:{background:"#503344"},otpCodeFieldInput:{color:"#f7f2e8",background:"#102542"},
    formFieldRow:{gap:"8px"},main:{gap:"24px"},
  },
};
function SignInPage() {
  return <div className="auth-page"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={`${basePath}/desk`}/></div>;
}
function SignUpPage() {
  return <div className="auth-page"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/desk`}/></div>;
}
function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/desk"/></Show><Show when="signed-out"><Landing/></Show></>;
}
function AgentWorkspace() {
  return <><Show when="signed-in"><Desk/></Show><Show when="signed-out"><Redirect to="/"/></Show></>;
}
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}
function NotFound() {
  return <div className="orbit-desk"><Empty title="Este camino no lleva a una conversación"><p>No encontramos la página que buscas.</p><Link href="/" className="contact-action">Volver al inicio</Link></Empty></div>;
}
function ClerkProviderWithRoutes() {
  const [location, setLocation] = useLocation();
  useEffect(() => {
    const label = location.startsWith("/chat/") ? "Atención al cliente" : location.startsWith("/desk") ? "Chat Support" : location.startsWith("/sign-up") ? "Crear cuenta" : location.startsWith("/sign-in") ? "Iniciar sesión" : "Atención para tu equipo";
    document.title = `${label} · Orbit Home`;
  }, [location]);
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        ...esES,
        signIn:{...esES.signIn,start:{...esES.signIn?.start,title:"Bienvenido de nuevo",subtitle:"Accede a tu espacio de atención"}},
        signUp:{...esES.signUp,start:{...esES.signUp?.start,title:"Crea tu espacio",subtitle:"Una cuenta para acompañar a tus clientes"}},
        formFieldLabel__emailAddress:"Correo electrónico",formFieldLabel__password:"Contraseña",
        formButtonPrimary:"Continuar",dividerText:"o",socialButtonsBlockButton:"Continuar con {{provider|titleize}}",
        backButton:"Volver",
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator/>
        <ErrorBoundary resetKey={location}>
          <Switch>
            <Route path="/" component={HomeRedirect}/>
            <Route path="/sign-in/*?" component={SignInPage}/>
            <Route path="/sign-up/*?" component={SignUpPage}/>
            <Route path="/desk" component={AgentWorkspace}/>
            <Route path="/chat/:key" component={PublicChat}/>
            <Route component={NotFound}/>
          </Switch>
        </ErrorBoundary>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes/></WouterRouter>;
}
export default App;
