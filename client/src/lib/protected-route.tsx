import { useAuth } from "@/hooks/use-auth";
import { Loader } from "@/components/Loader";
import { Route, useLocation } from "wouter";

export function ProtectedRoute({
  component: Component,
  path,
}: {
  component: () => React.JSX.Element | null;
  path: string;
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return <Route path={path} component={Loader} />;
  }

  if (!user) {
    return (
      <Route path={path}>
        {() => {
          setLocation("/auth");
          return null;
        }}
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
