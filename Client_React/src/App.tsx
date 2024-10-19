import { useEffect } from "react";
//import "./App.css";

import {
  socket,
} from "./services/Socket.ts";
import {
  ControllerInfoProvider
} from "./services/ControllerInfoContext.tsx";
import MainPage from "./components/MainPage.tsx";

function App() {
  useEffect(() => {
    socket.connect();
    socket.on("connect", handleConnect);
    socket.on("error", handleError);

    return () =>{
      socket.off("connect", handleConnect);
      socket.off("error", handleError);
      socket.disconnect();
    }
  }, [])

  return (
    <>
      <ControllerInfoProvider>
        <MainPage></MainPage>
      </ControllerInfoProvider>
    </>
  );

  function handleConnect(): void {
    // This is actually reestablishing connection. Subscribe to all previous watches.
    socket.emit("createWatchClient");
    socket.emit("requestControllerStatus");
    // for(let controllerName in this._model.watchList){
    //     this._model.watchList[controllerName].forEach((symbol) => {
    //     socket.emit("addWatchSymbol", controllerName, symbol.name);
    //     });
  }

  function handleError(err: any): void {
    console.log(err);
  }
}

export default App;
