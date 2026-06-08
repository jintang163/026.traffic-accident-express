import { create } from 'zustand';
import type { AccidentInfo, VehicleInfo, PhotoInfo, PlateInfo, LocationInfo } from '@/types/accident';

interface AccidentState {
  currentStep: number;
  totalSteps: number;
  vehicles: VehicleInfo[];
  scenePhotos: PhotoInfo[];
  currentVehicleIndex: number;
  location: LocationInfo | null;
  accidentType: string;
  description: string;
  weather: string;
  roadCondition: string;
  currentAccident: AccidentInfo | null;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  addVehicle: (vehicle: VehicleInfo) => void;
  updateVehicle: (index: number, vehicle: Partial<VehicleInfo>) => void;
  updatePlateInfo: (index: number, plateInfo: PlateInfo) => void;
  removeVehicle: (index: number) => void;
  setCurrentVehicleIndex: (index: number) => void;
  addScenePhoto: (photo: PhotoInfo) => void;
  removeScenePhoto: (photoId: string) => void;
  setLocation: (location: LocationInfo) => void;
  setAccidentType: (type: string) => void;
  setDescription: (desc: string) => void;
  setWeather: (weather: string) => void;
  setRoadCondition: (condition: string) => void;
  setCurrentAccident: (accident: AccidentInfo | null) => void;
  resetForm: () => void;
}

export const useAccidentStore = create<AccidentState>((set, get) => ({
  currentStep: 1,
  totalSteps: 4,
  vehicles: [],
  scenePhotos: [],
  currentVehicleIndex: 0,
  location: null,
  accidentType: '',
  description: '',
  weather: '晴',
  roadCondition: '干燥',
  currentAccident: null,

  setCurrentStep: (step) => set({ currentStep: step }),
  
  nextStep: () => {
    const { currentStep, totalSteps } = get();
    if (currentStep < totalSteps) {
      set({ currentStep: currentStep + 1 });
    }
  },
  
  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) {
      set({ currentStep: currentStep - 1 });
    }
  },
  
  addVehicle: (vehicle) => {
    const { vehicles } = get();
    set({ vehicles: [...vehicles, vehicle] });
  },
  
  updateVehicle: (index, vehicle) => {
    const { vehicles } = get();
    const newVehicles = [...vehicles];
    newVehicles[index] = { ...newVehicles[index], ...vehicle };
    set({ vehicles: newVehicles });
  },
  
  updatePlateInfo: (index, plateInfo) => {
    const { vehicles } = get();
    const newVehicles = [...vehicles];
    newVehicles[index] = { ...newVehicles[index], plateInfo };
    set({ vehicles: newVehicles });
  },
  
  removeVehicle: (index) => {
    const { vehicles } = get();
    const newVehicles = vehicles.filter((_, i) => i !== index);
    set({ vehicles: newVehicles });
  },
  
  setCurrentVehicleIndex: (index) => set({ currentVehicleIndex: index }),
  
  addScenePhoto: (photo) => {
    const { scenePhotos } = get();
    set({ scenePhotos: [...scenePhotos, photo] });
  },
  
  removeScenePhoto: (photoId) => {
    const { scenePhotos } = get();
    set({ scenePhotos: scenePhotos.filter(p => p.id !== photoId) });
  },
  
  setLocation: (location) => set({ location }),
  
  setAccidentType: (type) => set({ accidentType: type }),
  
  setDescription: (desc) => set({ description: desc }),
  
  setWeather: (weather) => set({ weather }),
  
  setRoadCondition: (condition) => set({ roadCondition: condition }),
  
  setCurrentAccident: (accident) => set({ currentAccident: accident }),
  
  resetForm: () => set({
    currentStep: 1,
    vehicles: [],
    scenePhotos: [],
    currentVehicleIndex: 0,
    location: null,
    accidentType: '',
    description: '',
    weather: '晴',
    roadCondition: '干燥',
    currentAccident: null
  })
}));
