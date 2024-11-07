import { Button } from "@mui/material";
import { IModelTreeNode } from "../../models/utilities";
import { useEffect, useRef, useState } from "react";
import { socket } from "../../services/Socket";
import { IControllerSymbol } from "../../models/controller-data-types";


interface IDownloadButtonProps{
  modelTreeNodes: IModelTreeNode[],
  currentController: string,
}


export default function DownloadButton(props: IDownloadButtonProps){
  const [displayText, setDisplayText] = useState("Download List");
  const requestedSymbolsRef = useRef<Record<string, IControllerSymbol>>({});

  useEffect(() => {
    function handleReceivedSybolValues(results: Record<string, Record<string, any>>){
      // result is in the shape of {controllerName: {symbolName: value}}
      setDisplayText("DownloadList");
      if (results[props.currentController]) {
        downloadSymbols(results[props.currentController]);
      }
    }

    function downloadSymbols(symbolValues: Record<string, any>){
      let tsvString = "";
      // convert the data into a string of tab separated values
      Object.keys(symbolValues).forEach((symbolName) => {
        const value = symbolValues[symbolName];
        let valueStr: string;
        if(value == null || value == undefined){
          valueStr = "";
        }
        else{
          switch(typeof value){
            case "string":
              valueStr = value;
              break;
            case "boolean":
            case "number":
              valueStr = value.toString();
              break;
            case "object":
              valueStr = JSON.stringify(value);
              break;
            default:
              return;
          }
        }
        tsvString += `${symbolName}\t${valueStr}\t${requestedSymbolsRef.current[symbolName].type}\t${requestedSymbolsRef.current[symbolName].comment}\n`;
      });
  
      //create  file for download
      const blob = new Blob([tsvString], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${props.currentController}_symbols.tsv`;
      link.href = url;
      link.click();
  
    }

    socket.on("readSymbolValuesCompleted", handleReceivedSybolValues);
  
    return () => {
      socket.off("readSymbolValuesCompleted", handleReceivedSybolValues);
    }
  }, [props.currentController])
  
  
  
  function handleClick(){
    setDisplayText("Loading...");
    const symbolList: string[] = [];
    requestedSymbolsRef.current = {};
    props.modelTreeNodes.forEach((node) => {
      dfs(node);
    })
    socket.emit("readSymbolValues", {[props.currentController]:symbolList});
    console.log(`requested ${symbolList}`);
    


    function dfs(node: IModelTreeNode){
      if(node.filterPassed){
        // passed filter
        if(!node.requestExpand){
          // not request expand, means it's the symbol that passed the filter, not its decendent
          symbolList.push(node.name);
          requestedSymbolsRef.current[node.name] = node.symbol;
        }
        else{
          // some decendent passed the filter. dive into the sub nodes
          node.subNodes.forEach((subNode) => dfs(subNode));
        }
      }
    }
  }
  


  return (
    <Button variant="contained" onClick={handleClick}>
      {displayText}
    </Button>
  )

}