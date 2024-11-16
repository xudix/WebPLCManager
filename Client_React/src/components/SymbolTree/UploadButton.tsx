import { Button, styled } from "@mui/material";
import UploadIcon from '@mui/icons-material/Upload';
import { ChangeEvent } from "react";
import { useWatchListUpdater } from "../../models/WatchListProvider";
import { useDataTypes, useSymbols, useUpdateNewValues } from "../../services/ControllerInfoContext";
import { IControllerSymbol, IControllerType } from "../../models/controller-data-types";

interface IUploadButtonProps{
  currentController: string,
}

export default function UploadButton(props: IUploadButtonProps) {

  const updateWatchList = useWatchListUpdater();
  const updateNewValue = useUpdateNewValues();
  const symbols = useSymbols();
  const dataTypes = useDataTypes();

  /**
   * after uploading file, populate the symbols of the file into the watch list, and add values as new values
   * @param event 
   * @returns 
   */
  async function handleFile(event: ChangeEvent<HTMLInputElement>){
    if(event.target.files?.[0]){
      const separator = 
        event.target.files[0].name.split(".").at(-1)?.toLowerCase() == "csv" ? 
          ",":"\t";
      
      return event.target.files[0].text().then((text) => {
        parseText(text, separator);
        event.target.value = "";
      })
    }
    else{
      return Promise.resolve();
    }
  }

  function parseText(text: string, separator: string){
    // break text into lines
    if(updateWatchList && updateNewValue){
      text.split(/\r*\n+\r*/).forEach((line) => {
        const split = line.split(separator);
        if(split.length > 1){
          // at least two items exist. first is symbol name, second is value
          const [symbolObj, typeObj] = getSymbolAndTypeByName(split[0]);
          if(symbolObj && typeObj){
            updateWatchList({
              type: "add",
              controllerName: props.currentController,
              item: {
                name: split[0],
                symbol: symbolObj,
                type: typeObj,
                filterPassed: true,
                isArrayRoot: false,
                subNodes: [],
              }
            });
            updateNewValue({
              type: "add",
              controllerName: props.currentController,
              symbol: split[0],
              value: split[1]
            })
          }
          
        }
      })
    }
  }

  function getSymbolAndTypeByName(fullName: string){
    //const lowerName = fullName.toLocaleLowerCase();
    const splitName = fullName.split(/[.[\]]+/);

    if(splitName.length > 1){
      const firstName = splitName.shift();
      splitName[0] = firstName + "." + splitName[0];
      if(symbols[props.currentController]?.[splitName[0].toLocaleLowerCase()]){
        return search(splitName, symbols[props.currentController][splitName[0].toLocaleLowerCase()]);
      }
      else{
        return [null, null]
      }
      
    }
    else{
      return [null, null];
    }

    function search(splitName: string[], symbolObj: IControllerSymbol):[IControllerSymbol | null, IControllerType | null]{
      
        const typeObj = dataTypes[props.currentController][symbolObj.type.toLocaleLowerCase()];
        // symbol name found
        if(splitName.length == 1){
          // found exact match
          return [
            symbolObj,
            typeObj
          ]
        }
        // not finished with the name yet
        else if(typeObj.arrayDimension > 0){
          // array
          let subSymbolType;
          if(typeObj.arrayDimension > 1){
            const subTypeObj = {...typeObj};
            if (subTypeObj.size){
              subTypeObj.size /= subTypeObj.arrayInfo[0].length;
            }
            subTypeObj.arrayDimension--;
            subTypeObj.arrayInfo = subTypeObj.arrayInfo.slice(1);
            subTypeObj.name = typeObj.name.replace(/(?<=\[)\d+\.\.\d+,\s*/, '');
            subSymbolType = subTypeObj.name;
            dataTypes[props.currentController][subTypeObj.name.toLocaleLowerCase()] = subTypeObj;
          }
          else{
            subSymbolType = typeObj.baseType;
          }
          const subSymbolObj = {...symbolObj};
          
          const firstName = splitName.shift();
          splitName[0] = firstName + "[" + splitName[0] + "]";
          subSymbolObj.name = splitName[0];
          subSymbolObj.type = subSymbolType;
          return search(splitName, subSymbolObj);
        }
        else if(typeObj.subItemCount > 0){
          // has sub items
          splitName.shift();
          for(const subSymbolObj of typeObj.subItems){
            if (splitName[0] == subSymbolObj.name){
              // this is the sub item
              return search(splitName, subSymbolObj);
            }
          }
          // not found
          return [null, null]
        }
        // this symbol has no sub
        return [null, null]
    }
  }

  return (
    <Button
      component="label"
      role={undefined}
      variant="contained"
      tabIndex={-1}
      startIcon={<UploadIcon />}
    >
      Upload files
      <VisuallyHiddenInput
        type="file"
        onChange={handleFile}
      />
    </Button>
  )
}

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});