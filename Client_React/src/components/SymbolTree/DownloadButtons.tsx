import { Button } from "@mui/material";
import { IModelTreeNode } from "../../models/utilities";
import { useRef, useState } from "react";
import { socket } from "../../services/Socket";
import { IControllerSymbol } from "../../models/controller-data-types";


interface IDownloadButtonProps{
  modelTreeNodes: IModelTreeNode[],
  currentController: string,
}


export default function DownloadButton(props: IDownloadButtonProps){
  const [displayText, setDisplayText] = useState("Download List");
  const requestedSymbolsRef = useRef<Record<string, IControllerSymbol>>({});

  function handleReceivedSybolValues(results: Record<string, Record<string, any>>){
    // result is in the shape of {controllerName: {symbolName: value}}
    setDisplayText("Download List");
    if (results[props.currentController]) {
      downloadSymbols(results[props.currentController]);
    }
    socket.off("readSymbolValuesCompleted", handleReceivedSybolValues);
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
      tsvString += `${symbolName}\t${valueStr}`;
      if(requestedSymbolsRef.current[symbolName]){
        tsvString += `\t${requestedSymbolsRef.current[symbolName].type}\t${requestedSymbolsRef.current[symbolName].comment}\n`;
      }
      else{
        tsvString += "\n";
      }
    });

    //create  file for download
    const blob = new Blob([tsvString], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${props.currentController}_symbols.tsv`;
    link.href = url;
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

  }
  
  
  
  function handleClick(){
    setDisplayText("Loading...");
    const symbolList: string[] = [];
    requestedSymbolsRef.current = {};
    props.modelTreeNodes.forEach((node) => {
      dfs(node);
    })
    socket.on("readSymbolValuesCompleted", handleReceivedSybolValues);
    socket.emit("readSymbolValues", {[props.currentController]:symbolList});
    console.log(`requested ${symbolList}`);
    console.log(requestedSymbolsRef.current);
    
    


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