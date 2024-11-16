import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import { useState } from 'react';
import { WatchPage } from './WatchPage';
import { WatchListProvider } from '../models/WatchListProvider';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      style={{flex:"1 1 auto"}}
      {...other}
    >
      {value === index && <Box sx={{ p: 0, m: 0, height:"100%" }}>{children}</Box>}
    </div>
  );
}



export default function MainPage() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentIndex(newValue);
  };

  return (
    <Box sx={{ width: '100%', height:"100vh", overflow:"clip", display:"flex", flexDirection:"column"}}>
      {/* <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={currentIndex} variant='fullWidth'
         onChange={handleChange} aria-label="basic tabs example">
          <Tab label="Watch" />
          <Tab label="Persistents" />
        </Tabs>
      </Box>
      <CustomTabPanel value={currentIndex} index={0}> */}
        <WatchListProvider>
          <WatchPage/>
        </WatchListProvider>
      {/* </CustomTabPanel>
      <CustomTabPanel value={currentIndex} index={1}>
        Persistent Page
      </CustomTabPanel> */}
    </Box>
  );
}