import NativeLogger from "../../SpectaclesInteractionKit/Utils/NativeLogger";
import { PresentationSwitcher } from "./PresentationSwitcher";
// REMOVE or comment out the import to CustomFileBridge
// import {CustomFileBridge} from "./CustomFileBridge"; // <-- DELETE THIS LINE

const log = new NativeLogger("SpeechToText");

// Keep your @component if you rely on the SIK (Spectacles Interaction Kit) pipeline.
@component
export class SpeechToText extends BaseScriptComponent {
  //-----------------------------------------------------------------------
  // 1) Replace direct CustomFileBridge import with a SceneObject reference:
  //-----------------------------------------------------------------------
  @input
  @hint("Scene object holding your CustomFileBridge script")
  customFileBridgeObj: SceneObject;  

  @input
  @hint("Text component to display transcriptions")
  text: Text;

  @input
  @hint("Reference to the PresentationSwitcher component")
  presentationSwitcher: PresentationSwitcher;

  // Remove the typed reference to 'CustomFileBridge' – it's not a real module in Lens
  // @input
  // @hint("Reference to the GoogleSlideBridge component") 
  // customFileBridge: CustomFileBridge;  // <-- DELETE THIS

  @input
  @hint("Delay time (in seconds) to wait before confirming a command")
  commandDelay: number = 2.0;

  @input
  @hint("The button image component to swap icons")
  buttonImage: Image;

  @input
  @hint("Texture for the normal mic icon (listening off)")
  normalMicImage: Texture;

  @input
  @hint("Texture for the listening mic icon (listening on)")
  listeningMicImage: Texture;

  @input
  @hint("Enable this boolean if you are planning to use the GoogleSlideBridge logic")
  useGoogleSlide: boolean = false;

  private voiceMLModule: VoiceMLModule = require("LensStudio:VoiceMLModule");
  private listeningOptions: VoiceML.ListeningOptions;
  private onListenUpdate: (eventData: VoiceML.ListeningUpdateEventArgs) => void;
  private eventRegistration: any;
  private lastTranscription: string = "";
  private commandPending: boolean = false;
  private commandTimer: number = 0;
  private isListening: boolean = false; // toggles listening state

  onAwake() {
    // Bind the onStart event
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
      log.d("OnStart event triggered");
    });

    // Bind the update event (for delay tracking)
    this.createEvent("UpdateEvent").bind(() => {
      this.update();
    });

    // Setup listening options
    this.listeningOptions = VoiceML.ListeningOptions.create();
    this.listeningOptions.speechRecognizer = VoiceMLModule.SpeechRecognizer.Default;
    this.listeningOptions.shouldReturnAsrTranscription = true;
    this.listeningOptions.shouldReturnInterimAsrTranscription = true;

    // Define the onListenUpdate callback
    this.onListenUpdate = (eventData: VoiceML.ListeningUpdateEventArgs) => {
      if (eventData.transcription.trim() === "") {
        log.d("Transcription is empty");
        return;
      }
      log.d(`Transcription: ${eventData.transcription}`);

      if (eventData.isFinalTranscription) {
        log.d(`Final Transcription: "${eventData.transcription}"`);
        if (this.isListening) {
          this.text.text = eventData.transcription;
          this.handleTranscription(eventData.transcription);
        } else {
          log.d("Listening is disabled - ignoring transcription");
        }
      }
    };

    // Set the initial mic icon
    if (this.buttonImage && this.normalMicImage) {
      this.buttonImage.mainMaterial.mainPass.baseTex = this.normalMicImage;
    } else {
      log.d("Button image or normal mic image not assigned in inspector");
    }
  }

  onStart() {
    // Setup VoiceMLModule callbacks
    this.voiceMLModule.onListeningEnabled.add(() => {
      log.d("Microphone permissions granted - starting listening");
      this.voiceMLModule.startListening(this.listeningOptions);
      this.eventRegistration = this.voiceMLModule.onListeningUpdate.add(this.onListenUpdate);
    });

    this.voiceMLModule.onListeningDisabled.add(() => {
      this.voiceMLModule.stopListening();
      if (this.eventRegistration) {
        this.voiceMLModule.onListeningUpdate.remove(this.eventRegistration);
        this.eventRegistration = null;
      }
      log.d("Listening stopped due to permissions being revoked");
      // Reset icon and state
      this.isListening = false;
      if (this.buttonImage && this.normalMicImage) {
        this.buttonImage.mainMaterial.mainPass.baseTex = this.normalMicImage;
      }
    });

    this.voiceMLModule.onListeningError.add((eventErrorArgs: VoiceML.ListeningErrorEventArgs) => {
      log.d(`Listening Error: ${eventErrorArgs.error}, Description: ${eventErrorArgs.description}`);
    });
  }

  // Public method to toggle listening
  public toggleListening() {
    this.isListening = !this.isListening;
    if (this.isListening) {
      log.d("Listening toggled ON");
      if (this.buttonImage && this.listeningMicImage) {
        this.buttonImage.mainMaterial.mainPass.baseTex = this.listeningMicImage;
      }
    } else {
      log.d("Listening toggled OFF");
      if (this.buttonImage && this.normalMicImage) {
        this.buttonImage.mainMaterial.mainPass.baseTex = this.normalMicImage;
      }
      this.text.text = ""; 
      this.commandPending = false; 
      this.lastTranscription = "";
    }
  }

  // Handle the transcription logic
  private handleTranscription(transcription: string) {
    const normalizedText = transcription.trim().toLowerCase();
    if (normalizedText === "next" || normalizedText === "next.") {
      log.d("Detected 'next' command - starting delay");
      this.lastTranscription = normalizedText;
      this.commandPending = true;
      this.commandTimer = 0;
    } else if (
      normalizedText === "previous" ||
      normalizedText === "previous." ||
      normalizedText === "go back" ||
      normalizedText === "go back."
    ) {
      log.d("Detected 'previous' or 'go back' command - starting delay");
      this.lastTranscription = normalizedText;
      this.commandPending = true;
      this.commandTimer = 0;
    } else {
      log.d(`Transcription "${transcription}" does not match any commands`);
      this.commandPending = false;
    }
  }

  // Called each frame for timing
  private update() {
    if (!this.commandPending) return;
    this.commandTimer += getDeltaTime();
    log.d(`Command delay timer: ${this.commandTimer.toFixed(2)} seconds`);

    if (this.commandTimer >= this.commandDelay) {
      const currentText = this.text.text.trim().toLowerCase();
      if (currentText === this.lastTranscription) {
        log.d(`Command "${this.lastTranscription}" confirmed after delay`);
        if (this.isListening) {
          if (this.lastTranscription === "next" || this.lastTranscription === "next.") {
            this.navigateToNext();
          } else if (
            this.lastTranscription === "previous" || 
            this.lastTranscription === "previous." ||
            this.lastTranscription === "go back" ||
            this.lastTranscription === "go back."
          ) {
            this.navigateToPrevious();
          }
        } else {
          log.d("Listening is disabled - ignoring command execution");
        }
      } else {
        log.d(`Command "${this.lastTranscription}" changed to "${currentText}" during delay - ignoring`);
      }
      this.commandPending = false;
      this.lastTranscription = "";
    }
  }

  // ------------------------------------
  //  Next/Previous Navigation
  // ------------------------------------
  private navigateToNext() {
    // 1) For local presentation (PresentationSwitcher)
    if (this.presentationSwitcher && !this.useGoogleSlide) {
      this.presentationSwitcher.next();
    }

    // 2) For your custom file bridge
    //    Instead of "this.customFileBridge.next()"
    //    we fetch the script from customFileBridgeObj
    if (this.useGoogleSlide && this.customFileBridgeObj) {
      const cfbScript = this.customFileBridgeObj.getComponent("Component.ScriptComponent");
      if (cfbScript && cfbScript.api && typeof cfbScript.api.next === "function") {
        cfbScript.api.next();
      }
    }
    log.d("Going to next slide");
  }

  private navigateToPrevious() {
    // 1) For local presentation
    if (this.presentationSwitcher && !this.useGoogleSlide) {
      this.presentationSwitcher.previous();
    }

    // 2) For custom file bridge
    if (this.useGoogleSlide && this.customFileBridgeObj) {
      const cfbScript = this.customFileBridgeObj.getComponent("Component.ScriptComponent");
      if (cfbScript && cfbScript.api && typeof cfbScript.api.previous === "function") {
        cfbScript.api.previous();
      }
    }
    log.d("Going to previous slide");
  }
}
