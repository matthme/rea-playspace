import React, { useEffect, useState } from "react";
import "@shoelace-style/shoelace/dist/themes/light.css";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import Header from "./components/layout/Header";
import Home from "./Home";
import NewAgent from "./components/layout/create/NewAgent";
import NewResourceSpecification from "./components/layout/create/NewResourceSpecification";
import NewProcessSpecification from "./components/layout/create/NewProcessSpecification";
import {
  profilesStoreContext,
  ProfilesStore
} from "@holochain-open-dev/profiles";
import {
  ContextProvider,
} from "./elements";
import { getProfilesStore } from "./data/ProfilesStore";
import ProfilePrompt from "./components/ProfilePrompt";

setBasePath(
  "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.0.0-beta.70/dist/"
);

interface Props {}

const App: React.FC<Props> = () => {

  const [store, setStore] = useState<ProfilesStore>();

  useEffect(() => {
    getProfilesStore().then((store) => {
      setStore(store);
    });
  }, []);


  const Main = () => {
    return (
      <BrowserRouter>
        <div className="container">
          <Header />
          <div className="below-header">
            <div className="main-panel">
              <Routes>
                <Route
                    path="/"
                    element={<Home />}>
                  </Route>

                  <Route
                    path="/agents/new"
                    element={<NewAgent />}
                  />
                  <Route
                    path="/resources/new"
                    element={<NewResourceSpecification />}
                  />
                  <Route
                    path="/processes/new"
                    element={<NewProcessSpecification />}
                  />
                </Routes>
            </div>
          </div>
        </div>
      </BrowserRouter>
    );
  }
  if (!store) {
    return <span>Loading.......</span>;
  }
  return (
    <ContextProvider context={profilesStoreContext} value={store}>
      <ProfilePrompt>
        <Main />
      </ProfilePrompt>
    </ContextProvider> 
  );
};

export default App;