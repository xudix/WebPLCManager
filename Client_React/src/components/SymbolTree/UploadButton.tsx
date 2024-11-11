import { Button, styled } from "@mui/material";
import UploadIcon from '@mui/icons-material/Upload';
import { ChangeEvent, SyntheticEvent } from "react";

interface IUploadButtonProps{
  currentController: string,
}

export default function UploadButton(props: IUploadButtonProps) {

  function handleFile(event: SyntheticEvent){
    console.log(event.target.files);
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