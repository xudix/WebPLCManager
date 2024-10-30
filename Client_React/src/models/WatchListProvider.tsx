import { createContext, Dispatch, ReactElement, useContext, useReducer } from "react";
import { IModelTreeNode } from "./utilities";

const WatchListContext = createContext<Record<string, Record<string, IModelTreeNode>>>({});
export function useWatchList()  {
  return useContext(WatchListContext)
};
const WatchListUpdaterContext = createContext<Dispatch<IWatchListAction>|null>(null);
export function useWatchListUpdater() {
  return useContext(WatchListUpdaterContext);
}

interface IWatchListAction{
  type: string,
  controllerName?: string,
  item?: IModelTreeNode,
}

function watchListReducer(watchList: Record<string, Record<string, IModelTreeNode>>, action: IWatchListAction): Record<string, Record<string, IModelTreeNode>>{
  let result = {...watchList};
  switch(action.type){
    case "add":
      if(action.controllerName && action.item){
        if(!result[action.controllerName]){
          result[action.controllerName] = {};
        }
        result[action.controllerName][action.item.name] = {...action.item, filterPassed: true, requestExpand: false};
      }
      break;
      
    case "delete":
    case "remove":
      if(action.controllerName &&
         action.item &&
         result[action.controllerName] &&
         result[action.controllerName][action.item.name]
        ){
          delete result[action.controllerName][action.item.name]
      }
      break;

    case "reset":
      result = {};
      break;

    default:
      
  }

  return result;

}

export function WatchListProvider({children}:{children: ReactElement}){
  const [watchList, updateWatchList] = useReducer(watchListReducer, {})

  return (
    <WatchListContext.Provider value={watchList}>
      <WatchListUpdaterContext.Provider value={updateWatchList}>
        {children}
      </WatchListUpdaterContext.Provider>
    </WatchListContext.Provider>
  )

}
