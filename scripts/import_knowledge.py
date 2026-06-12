from pathlib import Path
import chromadb
from chromadb.utils import embedding_functions

BASE_DIR = Path(__file__).parent.parent
CHROMA_DIR = BASE_DIR / "data" / "chroma"

client = chromadb.PersistentClient(path=str(CHROMA_DIR))
ef = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

try:
    client.delete_collection("training_knowledge")
    print("🗑️  Gamla chunks raderade")
except:
    pass

collection = client.get_or_create_collection(
    name="training_knowledge",
    embedding_function=ef
)

chunks = [
    # ── HRV STRESS RECOVERY 24H ──
    {
        "id": "hrv_recovery_1",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Sammanfattning och nyckelbegrepp",
        "text": "Autonomic nervous system (ANS) plays a key role in maintaining physiological functions of the body. Stress is physiologically manifested by increased sympathetic and diminished parasympathetic activity. Recovery occurs when physiological arousal is diminished and parasympathetic activity dominates. Heart rate variability (HRV) is associated with ANS activity and can be used for modeling physiological stress and recovery reactions. Stress is defined as increased activation level of the body when sympathetic activity dominates. Recovery is reduced activation level when parasympathetic activation dominates over sympathetic activity. Body resources represent the ability to cope with demands — the balance between stress and recovery reactions estimates whether body resources have been accumulated or consumed."
    },
    {
        "id": "hrv_recovery_2",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "ANS och HRV som indikator",
        "text": "The autonomic nervous system plays a major role in modifying heart rate according to need. Heart rate variability (HRV) refers to fluctuations in time between successive heartbeats, caused by respiration known as respiratory sinus arrhythmia. Sympathetic fibers increase heart rate and decrease HRV. The parasympathetic vagus nerve slows heart rate and increases HRV. During physical activity, parasympathetic activity is first withdrawn then sympathetic activity augmented to meet metabolic demands. Heart rate increases and HRV decreases with increasing exercise intensity. HRV provides a powerful tool for observing the interplay between sympathetic and parasympathetic nervous systems and is broadly accepted to reflect autonomic nervous system activity."
    },
    {
        "id": "hrv_recovery_3",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Faktorer som påverkar HRV",
        "text": "Higher HRV is associated with reduced morbidity and mortality, psychological well-being and quality of life, better physical fitness and lower age. Acute stress is associated with decreased HRV during sleep and daytime. Higher reported work stress is associated with lower HRV. The training status of athletes affects HRV — overtraining causes increased heart rate and reduced HRV. HRV is affected by training load of individual exercise sessions: the higher the training load, the lower the HRV after exercise. HRV is highly context dependent and reacts to acute stressors such as physical exercise. There are very high inter-individual differences in HRV which makes it difficult to interpret absolute HRV values."
    },
    {
        "id": "hrv_recovery_4",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Metodöversikt",
        "text": "The Firstbeat method utilizes HRV information from 24-hour ambulatory real-life measurements. HRV information is used to calculate physiological variables including oxygen consumption, respiration rate, and excess post-exercise oxygen consumption (EPOC) to model individual physiological reactions. The method detects stress when sympathetic activity dominates over parasympathetic activity. Recovery is detected when parasympathetic activity predominates. Physical activity is detected when oxygen consumption is elevated. The method forms an individual physiological model of the person, taking into account individuality concerning HR and HRV values."
    },
    {
        "id": "hrv_recovery_5",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Detektering av fysisk aktivitet, återhämtning och stress",
        "text": "Physical activity detection is based on oxygen consumption: if calculated VO2 is more than 30% of individual VO2max, the segment is physical activity. If VO2 is 20-30% of VO2max, it is daily physical activity. Recovery state is defined as parasympathetic predominance of ANS — heart rate is individually low and HRV is great and uniform. Recovery typically occurs during sleep, relaxation and rest. Stress state is defined as increased activation when sympathetic nervous system dominates and parasympathetic activation is low — individual heart rate is elevated, HRV is decreased from resting level, and respiration rate is low relative to HR."
    },
    {
        "id": "hrv_recovery_6",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Praktisk användning inom idrott",
        "text": "In sports settings, the Firstbeat method has been applied to assess training or competition induced stress, monitor training load and follow-up recovery in order to optimize training and performance and avoid overtraining. Body resources accumulate during recovery periods and decrease during stress reactions. The method provides absolute indices to express the strength of stress and recovery reactions and can assess the balance between stress and recovery. A 3-year follow-up case study with an international level race-walker showed simultaneous increase in HR and decrease in HRV during sleep after a hard training session or race, resulting in decreased recovery values. The method detected decreased recovery after hard training sessions."
    },
    {
        "id": "hrv_recovery_7",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Empiriska resultat",
        "text": "Research shows stress dominates daytime and relaxation dominates sleep time, confirming the method differentiates physiological states correctly. Recovery was diminished during sleep after intensive late-evening exercise. Recovery was decreased and heart rate increased during sleep after days with intensive or long-duration exercise compared to easy or short exercise — indicating delayed ANS recovery after demanding exercise. A typical 24-hour measurement included 51% stress, 26% recovery, 2% physical activity. An average of 60% of sleep time was detected as recovery. Workdays include more stress (52% vs 49%) and less recovery (25% vs 27%) than days off. High physical activity level and low BMI were related to good recovery during sleep and low amount of stress."
    },
    {
        "id": "hrv_recovery_8",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Slutsatser",
        "text": "Heart rate variability provides a non-invasive window to autonomic nervous system activity and can be used for detecting physiologically different states. The method utilizes HRV from long-term real-life measurements to recognize individually stressful and relaxing periods originating from lifestyle-related behaviors. The method is based on forming a digital physiological model of the individual using beat-to-beat heart rate data. HRV data is used for calculating autonomic nervous system activity, oxygen consumption, respiration rate, and exercise related variables such as EPOC. Knowledge about stress, recovery, and physical activity provided by the method can be utilized to explore health and well-being and support lifestyle changes."
    },

    # ── VO2MAX ESTIMATION ──
    {
        "id": "vo2max_1",
        "källa": "firstbeat_vo2max_estimation",
        "rubrik": "Vad är VO2max och varför är det viktigt",
        "text": "Maximal oxygen uptake or consumption (VO2max) means the maximal capacity of an individual to perform aerobic work. It is the golden standard measure for a person's aerobic fitness. Aerobic fitness is related to a person's ability to perform dynamic moderate-to-high intensity physical activity with large muscle groups for prolonged periods. Individual VO2max values can range from about 10 ml/kg/min in cardiac patients to close to 90 ml/kg/min among world-class endurance athletes. Aerobic fitness level is strongly and positively related to health, longevity, quality of life, and performance. For a person with poor fitness level, a 10% increase in VO2max can reduce mortality risk by 15% and give 10 more years of good-quality life."
    },
    {
        "id": "vo2max_2",
        "källa": "firstbeat_vo2max_estimation",
        "rubrik": "VO2max och löpprestation",
        "text": "Maximal oxygen uptake is a crucial determinant of endurance performance. VO2max sets the upper limit for metabolism during physical activity because it is impossible to exercise above 100% of VO2max for extended periods. The ability to exercise at high intensity for prolonged periods such as distance running is determined by fat oxidation, ability to buffer lactic acid, economy of performance, and fractional utilization of VO2max for the given speed. Running at 9 km/h requires 31 ml/kg/min, at 15 km/h requires 51 ml/kg/min, at 19.3 km/h requires 67 ml/kg/min, and at 22.5 km/h requires 81 ml/kg/min of oxygen."
    },
    {
        "id": "vo2max_3",
        "källa": "firstbeat_vo2max_estimation",
        "rubrik": "Firstbeat metod för VO2max estimering",
        "text": "The Firstbeat method for accurate assessment of aerobic fitness level (VO2max) is based on the well-known linear relationship between oxygen consumption and running speed. Technology such as GPS sensors enables reliable measurement of running speed along with heart rate continuously during each workout. The method segments collected data into different heart rate ranges, calculates reliability of different data segments, and uses the most reliable segments for estimating VO2max. Situations excluded from estimation include running on soft ground, steep downhill, stopping at traffic lights, or cardiovascular drift in long-duration workouts. The accuracy of the method when applied for running is 95% (MAPE ~5%), based on a database of 2690 freely performed runs."
    },
    {
        "id": "vo2max_4",
        "källa": "firstbeat_vo2max_estimation",
        "rubrik": "VO2max klassificering per åldersgrupp",
        "text": "VO2max fitness categories for men by age group: Age 20-29 — Poor below 41, Fair 41-44.8, Good 45.6-48.5, Excellent 51.1-54, Superior above 55.5. Age 30-39 — Poor below 39.5, Fair 40.7-43.9, Good 44.1-47, Excellent 48.3-51.7, Superior above 54.1. Age 40-49 — Poor below 37.6, Fair 38.4-41, Good 42.4-44.9, Excellent 46.4-49.6, Superior above 52.5. In general, the highest VO2max values are reached around age 20, after which aerobic fitness starts to decline. Men have about 20% higher values than women. Current evidence supports 10% decline per decade in VO2max regardless of activity level, although active individuals decline at a slower rate."
    },
    {
        "id": "vo2max_5",
        "källa": "firstbeat_vo2max_estimation",
        "rubrik": "Löptidsprediktion baserat på VO2max",
        "text": "Race time prediction based on VO2max (Jack Daniels formula): VO2max 30 — Marathon 4:49, Half marathon 2:21, 10K 1:03. VO2max 36 — Marathon 4:10, Half marathon 2:01, 10K 54:44. VO2max 42 — Marathon 3:40, Half marathon 1:46, 10K 48:01. VO2max 48 — Marathon 3:17, Half marathon 1:34, 10K 42:50. VO2max 54 — Marathon 2:58, Half marathon 1:25, 10K 38:42. VO2max 60 — Marathon 2:43, Half marathon 1:18, 10K 35:22. VO2max 66 — Marathon 2:30, Half marathon 1:11, 10K 32:35. If a sedentary runner improves VO2max by 2 ml/kg/min, marathon race time could improve by 15 minutes. The same improvement in an elite athlete improves marathon time by only one and a half minutes."
    },
    {
        "id": "vo2max_6",
        "källa": "firstbeat_vo2max_estimation",
        "rubrik": "Förbättra VO2max genom träning",
        "text": "Everyone can improve aerobic fitness by training. The magnitude of improvement depends substantially on the starting point and training intensity. The less fit an individual is when starting, the easier it is to increase VO2max. Vigorous exercising is more effective than moderate exercising for improving VO2max. A beginner may increase fitness level during 4-10 weeks of successive training by up to 10-20%, and even 44% increase in VO2max in ten weeks has been reported using very high-intensity interval training. For highly trained athletes with very high VO2max, it is extremely hard to significantly improve aerobic fitness within a short time period. If training load is too low, VO2max will not increase and can start to decrease. If training load is too high, fitness level can decrease due to overloading. With optimal training load, fitness level development is the greatest."
    },
    {
        "id": "vo2max_7",
        "källa": "firstbeat_vo2max_estimation",
        "rubrik": "Supercompensation och återhämtning",
        "text": "Periodization of hard and easy training is the key for successful fitness improvement. Athletic performance improves as the athlete adapts to progressively increasing training loads, and this adaptation occurs during periods of recovery and reduced training. High-intensity training for longer periods results in a decrease in performance. If there is a reasonable recovery phase after that, performance will return to baseline and further above it — this is called supercompensation. If a new exercise session is applied at the peak of supercompensation, it results in further enhancement in performance. The time needed for supercompensation and recovery is individual and greatly affected by training, stress, eating, sleeping, and health status. The Firstbeat VO2max method can be used to indicate supercompensation and recovery from previous training."
    },
    {
        "id": "vo2max_8",
        "källa": "firstbeat_vo2max_estimation",
        "rubrik": "Slutsatser om VO2max",
        "text": "Aerobic fitness level has been strongly and positively associated with reduced disease and mortality risk, good quality of life, performance level, and functional ability. Having a high aerobic capacity reduces cardiovascular disease risk more than merely being physically active. Engaging only in physical activity at low intensity might not increase aerobic capacity. The Firstbeat method utilizes only reliable data periods and has been found to be very accurate. The method makes it possible to evaluate effectiveness of training on a day-to-day basis rather than checking aerobic fitness level seldom with separate tests. The method allows continuous follow-up of aerobic fitness and helps to plan and personalize training."
    },

    # ── RECOVERY ANALYSIS FOR ATHLETIC TRAINING ──
    {
        "id": "recovery_1",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Återhämtningens betydelse för atleter",
        "text": "The benefits of training are accomplished only through the recovery process. Performance improvements actually occur during recovery from training, not during workouts. Finding a balance between training load and recovery is a fundamental factor in improving athletic performance. Too hard training without sufficient rest may lead to overtraining condition, characterized by decreased performance and harmful effects on health. Recovery from overtraining may take from several weeks to months, and it is possible that an athlete never reaches the previous performance level. Prevention of overtraining is therefore critical. Recovery needs to be constantly evaluated for optimizing stress on the body and for avoiding both over- and undertraining when seeking the most efficient programming of training."
    },
    {
        "id": "recovery_2",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "ANS och HRV som återhämtningsindikator",
        "text": "The autonomic nervous system (ANS) plays a major role in maintaining the body's homeostasis. The sympathetic nervous system prepares the body for challenging situations and is activated during physical activity. The parasympathetic nervous system has the opposite role — increased parasympathetic activity enables recovery. HRV provides a powerful tool for observing the interplay between sympathetic and parasympathetic nervous systems. When the body is exposed to stress such as physical exercise, sympathetic activation occurs and HRV decreases. During the recovery process parasympathetic activity increases, heart rate decreases, and HRV increases. Increased parasympathetic activity of the ANS is the fundamental characteristic of recovery and shows that the body is able to reduce its physiological activation level."
    },
    {
        "id": "recovery_3",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Faktorer som påverkar återhämtning",
        "text": "In addition to physical training, various other factors can cause stress or increased need for recovery. Important sources of stress include: illness, lack of sleep or poor sleep quality, medication, jetlag, high altitude, adaptation to new environment, hard training session or race performed late in the evening, alcohol or hangover, work-related stress factors, social stress factors, and emotional stress factors. It is also possible that athlete's performance is decreased due to training-induced tension or soreness in musculature, which is not necessarily revealed by HRV-based methods. The underlying causes of stress should always be taken into account when adjusting training and interpreting the recovery status of an athlete."
    },
    {
        "id": "recovery_4",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Överträning och dess kännetecken",
        "text": "If mental stress, high training load or other sources of stress, or their combination lasts for prolonged periods without adequate rest, it is possible that a state of overtraining or exhaustion develops. Before the actual overtraining syndrome develops, it is possible to detect signs of inadequate recovery — shown by increased sympathetic nervous system activity and decreased parasympathetic activity even during periods when an athlete should be recovered, such as during sleep. Overtraining state: HR may be at normal level but HRV is diminished and Recovery Index is very low. Rest or very light training is suggested until the Recovery Index returns to a normal level, which may take from weeks to several months."
    },
    {
        "id": "recovery_5",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Firstbeat återhämtningsanalys och Recovery Index",
        "text": "The Firstbeat recovery analysis method is designed to sensitively measure an athlete's recovery status based on analyzing HRV from beat-to-beat heart rate data. Recovery Index is calculated from HR level, HRV low and high frequency power, and HRV-based respiration rate. The values are individually scaled based on user's measurement history — intensity of recovery is compared to the highest measurement in record. For sleep time, the method uses a 4-hour window starting 30 minutes after going to bed for determining the Recovery Index. Recovery Index has been found to be more sensitive to athletes' recovery status than basic HR or traditional HRV measures. A 3-year follow-up study found the method measured recovery state accurately both after single hard training days and after overreaching periods."
    },
    {
        "id": "recovery_6",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Hur man tillämpar återhämtningsanalys i träning",
        "text": "Recovery assessments should always be started before hard training periods — it is difficult to detect inadequate recovery without a reference level. Recovery assessment is recommended even after a single hard training day; recovery status should be lower than normally during the subsequent night's sleep and move closer to baseline during following nights. During an overreaching period, recovery status should weaken towards the end of period. If recovery status does not worsen during a hard training period, training has probably been too easy. Intensive training should not be restarted before recovery values are at least close to those of well-recovered state. Regular HRV analysis is needed to react soon enough to undesirable changes in athlete's recovery state."
    },
    {
        "id": "recovery_7",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Träningsstatus och Recovery Index tolkning",
        "text": "Well recovered with no training fatigue: HR is low and HRV is great — harder training can be programmed or restarted. Not fully recovered from single hard training session: HR is higher and HRV lower than in well recovered state, Recovery Index is slightly decreased — easier training is suggested until recovery returns to normal. High training-related fatigue after overreaching period: HR is significantly higher and HRV lower than well recovered, Recovery Index is low — good body recovery should be allowed immediately after overreaching period before restarting harder training. Overtraining caused by long period of hard training: HR may be at normal level but HRV is diminished, Recovery Index is very low — rest or very light training is suggested until Recovery Index returns to normal, may take weeks to several months."
    },
    {
        "id": "recovery_8",
        "källa": "firstbeat_stress_recovery_24h",
        "rubrik": "Individualisering och lagsporter",
        "text": "Varying training load during training sessions and matches for different team members, and varying capability of different individuals to recover is a widely known challenge in team sports. If individual's recovery is incomplete it may lead to decreased personal performance which may even affect the whole team's performance. The coach can either assess a few players suspected to have difficulties with recovery, or track the whole team. Key findings from elite ice-hockey team study: 1) it is extremely important what happens in athletes' life between games, 2) the night after a game is the most crucial period for recovery, 3) recovery was delayed more after away than home games, 4) there are big individual differences in recovery after games, 5) systematic recovery assessment is the key for better recovery."
    },

    # ── TRAINING EFFECT ──
    {
        "id": "training_effect_1",
        "källa": "firstbeat_training_effect",
        "rubrik": "EPOC och träningseffekt - grundprinciper",
        "text": "EPOC (excess post-exercise oxygen consumption) measures the quantity of exercise-induced disturbance of body's homeostasis. Training effect indicates the effect of a single exercise session on improvement of cardiorespiratory fitness. An overload must be applied to the body to disturb its homeostasis and a sufficient recovery period is required to allow a training effect to occur. The harder the exercise with higher intensity and longer duration, the greater the overload and related disturbance in homeostasis, resulting in a larger training effect. Training load must be gradually increased to improve fitness level long term. As fitness improves, the balance between training and recovery becomes very important — training must be hard but adequate recovery must also be allowed."
    },
    {
        "id": "training_effect_2",
        "källa": "firstbeat_training_effect",
        "rubrik": "Träningseffektnivåer och deras tolkning",
        "text": "Training effect is divided into five levels describing the effect of a single exercise session on cardiorespiratory fitness. Level 1.0-1.9 Minor — exercise does not improve cardiorespiratory fitness, suitable for recovery enhancement and endurance base with long duration exercise over 1 hour. Level 2.0-2.9 Maintaining — exercise maintains cardiorespiratory fitness, builds foundation for harder training. Level 3.0-3.9 Improving — exercise improves cardiorespiratory fitness if done 2-4 times per week, no special recovery requirements. Level 4.0-4.9 Highly improving — exercise sharply improves fitness when done about 1-2 times per week, requires 2-3 easier sessions to balance training, more attention on recovery. Level 5.0 Overreaching — dramatic increases occur after overreaching exercise if adequate recovery is applied, should be performed only occasionally with special attention on recovery."
    },
    {
        "id": "training_effect_3",
        "källa": "firstbeat_training_effect",
        "rubrik": "EPOC i korthet - nyckelprinciper",
        "text": "The higher the intensity (proportion of VO2max used) and the longer the duration of exercise, the more EPOC accumulates. The shorter the recovery periods during exercise, the higher the EPOC. Exercises recruiting large muscle mass such as cross country skiing result in higher cardiorespiratory load and higher EPOC compared to exercises recruiting smaller muscle mass. The higher the EPOC, the higher the training effect. Active and fit individuals need harder exercise than less active individuals to improve cardiorespiratory fitness — an active person needs a higher EPOC than a less active person to reach a similar training effect. TE assessment also takes into account changes in physical activity level — less disturbance is required to increase fitness if activity level has dropped."
    },
    {
        "id": "training_effect_4",
        "källa": "firstbeat_training_effect",
        "rubrik": "Träningsprogram för nybörjare och tränade",
        "text": "For beginners (activity class 0-2): exercise should be performed regularly 2-5 times per week, easy sessions scheduled between harder ones, start with easy week and continue with medium and hard weeks. For trained individuals (activity class 3-5): effective sessions 1-4 times per week, workouts of long duration and low TE needed between demanding workouts to maintain endurance base, easier training periods must be scheduled between demanding ones. For elite athletes (activity class 9-10): important to maximize VO2max, fatigue resistance, sport-specific technique and economy by increasing number of intensive sessions. All workouts cannot be improving — a few weekly sessions must remain maintaining. Even top endurance athletes need easy weeks between harder ones to ensure the body adapts and recovers."
    },
    {
        "id": "training_effect_5",
        "källa": "firstbeat_training_effect",
        "rubrik": "Lågintensiv träning för aerob bas och återhämtning",
        "text": "Despite high intensity exercises with long duration being most effective, exercise sessions with low training effect are also necessary to build a firm endurance base. The base is most efficiently improved with long easy workouts achieving only Minor (TE 1) or Maintaining (TE 2) training effect. This kind of training does not directly improve maximal cardiorespiratory fitness but is necessary to be able to train intensively and reach top-level VO2max. Volume of low intensity training is quite high in elite endurance athletes — typically only 3-4 intensive exercise sessions per week, corresponding to about 10-15% of total training volume. Another reason for low-intensity exercise is to enhance recovery — if exhausted and recovery enhancement is needed, short recovery exercise with low TE (1-2) is preferred."
    },
    {
        "id": "training_effect_6",
        "källa": "firstbeat_training_effect",
        "rubrik": "Pulsbaserad träning och träningseffekt",
        "text": "Heart rate level provides indirect information on exercise intensity and is commonly used to control training workload. To avoid too high intensity, one should try to remain at about 65-85% of maximal heart rate throughout exercise. Excessive load is avoided by assuring that EPOC does not accumulate beyond training effect of 1.0-2.9. Momentary heart rate level alone does not provide sufficient information for controlling the load of whole exercise since overall load accumulates during exercise. EPOC based training effect can be used to control training across different types of exercises with different durations, allowing changes in exercise intensity. EPOC should be relatively high during exercise planned to improve cardiorespiratory fitness — training effect of at least 3.0 or higher."
    },
    {
        "id": "training_effect_7",
        "källa": "firstbeat_training_effect",
        "rubrik": "Överträning - kännetecken och prevention",
        "text": "Overtraining state is characterized by a decrease in performance capacity that develops during a long time of hard training without sufficient recovery. Training effect assessment gives information on physiological training load that can be used to prevent overtraining state. Overtraining may occur after prolonged intensive training with repeated sessions at high TE (4-5) without sufficient recovery — in early overtraining EPOC and TE may be higher than before due to increased sympathetic arousal. A very long period of excessive high volume training leads to overtraining characterized by attenuated physiological responses where EPOC and TE may be significantly lower than expected even if exercise effort is high. Decreased performance is still the best marker of overtraining. Recovery from overtraining requires rest from weeks to months."
    },
    {
        "id": "training_effect_8",
        "källa": "firstbeat_training_effect",
        "rubrik": "Faktorer som påverkar träningseffektbedömning",
        "text": "Factors that may cause inaccuracy in training effect assessment: False personal background parameters — TE is underestimated if maximal heart rate or activity class is set too high, overestimated if set too low. Illness — higher EPOC and TE compared to similar exercise in good health due to illness-induced increases in heart rate and respiration — training effect does not occur during illness despite high EPOC, exercise should not be performed when ill. Hard environmental conditions such as high temperature, humidity, or high altitude cause higher TE than similar exercise in normal conditions. Overtraining during long high-volume period — TE may be lower than expected due to attenuated physiological responses. Emphasis on recovery until normal training state is reached."
    },
]

ids = [c["id"] for c in chunks]
dokument = [c["text"] for c in chunks]
metadatas = [{"källa": c["källa"], "rubrik": c["rubrik"]} for c in chunks]

collection.add(documents=dokument, ids=ids, metadatas=metadatas)
print(f"✅ {len(chunks)} chunks inlästa i ChromaDB!")